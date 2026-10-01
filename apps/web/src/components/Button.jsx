import { Link } from 'react-router-dom';

const BASE =
  'inline-flex items-center justify-center gap-2 rounded-control px-5 font-semibold transition-colors disabled:cursor-not-allowed disabled:opacity-60';

const VARIANTS = {
  primary: 'bg-accent text-on-accent hover:brightness-95',
  secondary: 'border border-line bg-transparent text-ink hover:bg-tile',
  destructive: 'border border-danger bg-transparent text-danger hover:bg-soft-danger',
};

const SIZES = {
  medium: 'min-h-11 text-sm',
  large: 'min-h-12 text-base',
};

export function buttonClasses({ variant = 'primary', size = 'medium', className = '' } = {}) {
  return [BASE, VARIANTS[variant], SIZES[size], className].join(' ');
}

export function Button({ variant, size, className, type = 'button', ...props }) {
  return <button type={type} className={buttonClasses({ variant, size, className })} {...props} />;
}

export function ButtonLink({ variant, size, className, to, href, children, ...props }) {
  const classes = buttonClasses({ variant, size, className });
  if (href) {
    return (
      <a href={href} className={classes} {...props}>
        {children}
      </a>
    );
  }
  return (
    <Link to={to} className={classes} {...props}>
      {children}
    </Link>
  );
}
