import './Spinner.css'

interface SpinnerProps {
  size?: 'sm' | 'md' | 'lg'
}

export function Spinner({ size = 'md' }: SpinnerProps) {
  return <div className={`spinner spinner--${size}`} role="status" aria-label="Loading" />
}
