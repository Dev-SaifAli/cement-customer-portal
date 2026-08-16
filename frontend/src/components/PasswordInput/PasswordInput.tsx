import { useState, type ComponentProps } from 'react';
import { Eye, EyeOff, Lock } from 'lucide-react';
import Input from '../Input/Input';

type PasswordInputProps = Omit<ComponentProps<typeof Input>, 'type' | 'icon' | 'rightSlot'>;

export default function PasswordInput(props: PasswordInputProps) {
  const [visible, setVisible] = useState(false);
  return (
    <Input
      {...props}
      type={visible ? 'text' : 'password'}
      icon={<Lock size={16} />}
      rightSlot={
        <button
          type="button"
          className="toggle-eye"
          onClick={() => setVisible((current) => !current)}
          aria-label={visible ? 'Hide password' : 'Show password'}
        >
          {visible ? <EyeOff size={18} /> : <Eye size={18} />}
        </button>
      }
    />
  );
}
