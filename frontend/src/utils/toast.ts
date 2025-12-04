import toast from 'react-hot-toast';

export const showError = (message: string) => {
  toast.error(message, {
    duration: 4000,
    position: 'top-center',
    style: {
      background: '#ffebee',
      color: '#c62828',
      border: '1px solid #ef5350',
      fontFamily: 'Inter, sans-serif',
    },
  });
};

export const showSuccess = (message: string) => {
  toast.success(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#e6f4ea',
      color: '#1e7e34',
      border: '1px solid #34a853',
      fontFamily: 'Inter, sans-serif',
    },
  });
};

export const showInfo = (message: string) => {
  toast(message, {
    duration: 3000,
    position: 'top-center',
    style: {
      background: '#FFFFFF',
      color: '#333333',
      border: '1px solid #E4E6EB',
      fontFamily: 'Inter, sans-serif',
    },
  });
};

