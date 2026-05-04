import { forwardRef } from 'react';
import { Link, NavLink, LinkProps, NavLinkProps } from 'react-router-dom';
import { useLanguage } from '../hooks/useLanguage';
import { withLangPrefix } from '../hooks/useLocalizedNavigate';

function localizeTo(to: LinkProps['to'], lang: string): LinkProps['to'] {
  if (typeof to === 'string') return withLangPrefix(to, lang);
  if (to && typeof to === 'object' && 'pathname' in to && typeof to.pathname === 'string') {
    return { ...to, pathname: withLangPrefix(to.pathname, lang) };
  }
  return to;
}

export const LocalizedLink = forwardRef<HTMLAnchorElement, LinkProps>(
  function LocalizedLink({ to, ...rest }, ref) {
    const lang = useLanguage();
    return <Link {...rest} to={localizeTo(to, lang)} ref={ref} />;
  }
);

export const LocalizedNavLink = forwardRef<HTMLAnchorElement, NavLinkProps>(
  function LocalizedNavLink({ to, ...rest }, ref) {
    const lang = useLanguage();
    return <NavLink {...rest} to={localizeTo(to, lang)} ref={ref} />;
  }
);
