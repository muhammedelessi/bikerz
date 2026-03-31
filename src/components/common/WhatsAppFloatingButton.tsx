import React from 'react';

const WHATSAPP_NUMBER = '966562562368';

const WhatsAppFloatingButton: React.FC = () => {
  return (
    <a
      href={`https://wa.me/${WHATSAPP_NUMBER}`}
      target="_blank"
      rel="noopener noreferrer"
      aria-label="WhatsApp"
      className="fixed bottom-6 right-6 z-50 flex h-14 w-14 items-center justify-center rounded-full shadow-lg transition-transform hover:scale-110 active:scale-95"
      style={{ backgroundColor: '#25D366' }}
    >
      <svg viewBox="0 0 32 32" className="w-7 h-7" fill="white">
        <path d="M16.004 0h-.008C7.174 0 0 7.176 0 16.004c0 3.5 1.132 6.744 3.058 9.378L1.058 31.14l5.962-1.966A15.9 15.9 0 0 0 16.004 32C24.826 32 32 24.826 32 16.004 32 7.176 24.826 0 16.004 0zm9.342 22.616c-.394 1.108-1.946 2.028-3.2 2.296-.86.182-1.98.326-5.756-1.238-4.832-2-7.94-6.9-8.18-7.22-.232-.318-1.942-2.586-1.942-4.932 0-2.346 1.23-3.498 1.666-3.976.394-.432 1.038-.628 1.654-.628.198 0 .378.01.538.018.478.02.716.048 1.032.798.394.936 1.352 3.282 1.472 3.52.12.24.24.554.08.872-.152.326-.284.47-.524.742-.24.272-.468.48-.708.774-.22.26-.468.538-.194.998.274.46 1.218 2.006 2.616 3.252 1.796 1.6 3.31 2.094 3.782 2.326.394.194.862.154 1.148-.154.364-.392.814-.942 1.272-1.484.326-.386.738-.434 1.17-.26.438.168 2.778 1.31 3.254 1.548.478.24.794.356.912.554.116.198.116 1.148-.278 2.256z"/>
      </svg>
    </a>
  );
};

export default WhatsAppFloatingButton;
