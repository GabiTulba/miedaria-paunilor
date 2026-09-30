import type { LockerMapConfig } from '../types/generated/LockerMapConfig';
import type { Language } from '../hooks/useLanguage';

/// Sameday's easybox map. The script opens a full-screen iframe from
/// lockerplugin.sameday.ro (allowed by the site's CSP) and reports the chosen
/// locker through `subscribe`. It is loaded only when the customer asks to
/// choose a locker, so no Sameday code runs before that.
const SCRIPT_URL = 'https://cdn.sameday.ro/locker-plugin/lockerpluginsdk.js';
const CHOSEN_LOCKER_KEY = 'easybox_locker';

export interface ChosenLocker {
    lockerId: number;
    name: string;
    address: string;
    city: string;
    county: string;
}

interface LockerPluginInstance {
    subscribe: (callback: (locker: ChosenLocker & { oohType?: number }) => void) => void;
    open: () => void;
    close: () => void;
}

interface LockerPluginGlobal {
    init: (options: Record<string, unknown>) => void;
    getInstance: () => LockerPluginInstance;
}

declare global {
    interface Window {
        LockerPlugin?: LockerPluginGlobal;
    }
}

let scriptLoad: Promise<LockerPluginGlobal> | null = null;

function loadScript(): Promise<LockerPluginGlobal> {
    scriptLoad ??= new Promise((resolve, reject) => {
        const script = document.createElement('script');
        script.src = SCRIPT_URL;
        script.async = true;
        script.referrerPolicy = 'no-referrer';
        script.onload = () => (window.LockerPlugin ? resolve(window.LockerPlugin) : reject(new Error('LockerPlugin missing')));
        script.onerror = () => {
            scriptLoad = null;
            script.remove();
            reject(new Error('Could not load the easybox map'));
        };
        document.head.appendChild(script);
    });
    return scriptLoad;
}

function isChosenLocker(value: unknown): value is ChosenLocker {
    const v = value as Partial<ChosenLocker> | null;
    return (
        !!v &&
        Number.isInteger(v.lockerId) &&
        [v.name, v.address, v.city, v.county].every(field => typeof field === 'string')
    );
}

/// Opens the map; `onChoose` receives the locker the customer picked.
/// Only easybox lockers are offered: the shop does not deliver to pickup points.
export async function openLockerMap(
    config: LockerMapConfig,
    language: Language,
    onChoose: (locker: ChosenLocker) => void,
): Promise<void> {
    const plugin = await loadScript();
    plugin.init({
        clientId: config.client_id,
        apiUsername: config.api_username,
        countryCode: 'RO',
        langCode: language,
        filters: [{ showLockers: true }, { showPudos: false }],
    });
    const instance = plugin.getInstance();
    instance.subscribe(locker => {
        if (!isChosenLocker(locker) || (locker.oohType ?? 0) !== 0) return;
        const chosen: ChosenLocker = {
            lockerId: locker.lockerId,
            name: locker.name,
            address: locker.address,
            city: locker.city,
            county: locker.county,
        };
        rememberLocker(chosen);
        onChoose(chosen);
        instance.close();
    });
    instance.open();
}

/// The chosen locker is kept for this tab only, so returning from the
/// product pages doesn't ask for it again.
export function rememberedLocker(): ChosenLocker | null {
    try {
        const parsed: unknown = JSON.parse(window.sessionStorage?.getItem(CHOSEN_LOCKER_KEY) ?? 'null');
        return isChosenLocker(parsed) ? parsed : null;
    } catch {
        return null;
    }
}

function rememberLocker(locker: ChosenLocker): void {
    try {
        window.sessionStorage?.setItem(CHOSEN_LOCKER_KEY, JSON.stringify(locker));
    } catch {
        // sessionStorage unavailable: the customer picks again next visit.
    }
}

export function forgetLocker(): void {
    try {
        window.sessionStorage?.removeItem(CHOSEN_LOCKER_KEY);
    } catch {
        // ignore
    }
}
