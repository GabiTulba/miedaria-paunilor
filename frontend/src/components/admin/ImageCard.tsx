import { useState } from 'react';
import { useTranslation } from 'react-i18next';
import { Image } from '../../types';
import { getImageUrl } from '../../lib/api';
import { useFormattedDate } from '../../hooks/useFormattedDate';

interface ImageCardProps {
    image: Image;
    isRenaming: boolean;
    deleteLoading: boolean;
    onStartRename: () => void;
    onCancelRename: () => void;
    onSaveRename: (newName: string) => Promise<void>;
    onDelete: () => void;
}

export default function ImageCard({
    image,
    isRenaming,
    deleteLoading,
    onStartRename,
    onCancelRename,
    onSaveRename,
    onDelete,
}: ImageCardProps) {
    const { t } = useTranslation();
    const formatDate = useFormattedDate();
    const [draftName, setDraftName] = useState(image.file_name);
    const [renameLoading, setRenameLoading] = useState(false);

    const handleStart = () => {
        setDraftName(image.file_name);
        onStartRename();
    };

    const handleSave = async () => {
        if (!draftName.trim()) return;
        setRenameLoading(true);
        try {
            await onSaveRename(draftName);
        } finally {
            setRenameLoading(false);
        }
    };

    return (
        <div className="image-card">
            <div className="image-preview">
                <img src={getImageUrl(image.id)} alt={image.file_name} className="image-thumbnail" />
                {isRenaming && (
                    <div className="rename-overlay" role="dialog" aria-modal="true">
                        <div className="rename-dialog">
                            <input
                                type="text"
                                value={draftName}
                                onChange={(e) => setDraftName(e.target.value)}
                                disabled={renameLoading}
                                className="rename-input"
                                autoFocus
                            />
                            <div className="rename-actions">
                                <button
                                    onClick={handleSave}
                                    disabled={renameLoading}
                                    className="button button-small button-success"
                                >
                                    {t('common.save')}
                                </button>
                                <button
                                    onClick={onCancelRename}
                                    disabled={renameLoading}
                                    className="button button-small button-secondary"
                                >
                                    {t('common.cancel')}
                                </button>
                            </div>
                        </div>
                    </div>
                )}
            </div>
            <div className="image-info">
                <div className="image-name">
                    {isRenaming ? (
                        <div className="renaming-indicator">{t('admin.images.rename')}</div>
                    ) : (
                        <>
                            <span className="file-name">{image.file_name}</span>
                            <span className="file-size">({(image.file_size / 1024).toFixed(1)} KB)</span>
                        </>
                    )}
                </div>
                <div className="image-meta">
                    <span className="image-id">ID: {image.id.substring(0, 8)}...</span>
                    <span className="image-date">{formatDate(image.created_at)}</span>
                </div>
            </div>
            <div className="image-actions">
                {!isRenaming && (
                    <>
                        <button
                            onClick={handleStart}
                            className="button button-small button-secondary"
                            disabled={deleteLoading}
                        >
                            {t('admin.images.rename')}
                        </button>
                        <button
                            onClick={onDelete}
                            disabled={deleteLoading}
                            className="button button-small button-danger"
                        >
                            {deleteLoading ? t('common.deleting') : t('admin.images.delete')}
                        </button>
                    </>
                )}
            </div>
        </div>
    );
}
