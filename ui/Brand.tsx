import logoLight from '../brand/01-logo/svg/wid-logo-grafite.svg';
import logoDark from '../brand/01-logo/svg/wid-logo-branco.svg';
import iconLight from '../brand/02-icone/svg/wid-icone-grafite.svg';
import iconDark from '../brand/02-icone/svg/wid-icone-branco.svg';

export function Brand({ dark, compact = false }: { dark: boolean; compact?: boolean }) {
  const src = compact ? (dark ? iconDark : iconLight) : dark ? logoDark : logoLight;
  return (
    <img
      src={src}
      alt="WID"
      width={compact ? 512 : 1220}
      height={compact ? 512 : 415}
      className={compact ? 'size-7' : 'h-10 w-auto'}
    />
  );
}
