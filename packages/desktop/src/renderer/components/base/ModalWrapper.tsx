import type { ModalProps } from '@arco-design/web-react';
import { Modal } from '@arco-design/web-react';
import { Close } from '@icon-park/react';
import React from 'react';

interface ModalWrapperProps extends Omit<ModalProps, 'title'> {
  children?: React.ReactNode;
  title?: React.ReactNode;
  showCustomClose?: boolean;
}

const ModalWrapper: React.FC<ModalWrapperProps> = ({
  children,
  title,
  showCustomClose = true,
  onCancel,
  className = '',
  ...props
}) => {
  return (
    <Modal {...props} title={null} closable={false} onCancel={onCancel} className={`bytetensor-modal ${className}`}>
      <div>
        {showCustomClose && title && (
          <div className='bytetensor-modal-header'>
            <h3 className='bytetensor-modal-title'>{title}</h3>
            <button onClick={onCancel} className='bytetensor-modal-close-btn'>
              <Close size={20} fill='#86909c' />
            </button>
          </div>
        )}
        {children}
      </div>
    </Modal>
  );
};

export default ModalWrapper;
