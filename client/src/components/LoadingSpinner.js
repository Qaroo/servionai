import React from 'react';
import { Oval } from 'react-loader-spinner';

/**
 * קומפוננטת טעינה שמציגה אנימציה בזמן טעינה
 */
const LoadingSpinner = ({ size = "large", message = "טוען..." }) => {
  // הגדרת הגודל על פי הפרמטר שהתקבל
  const spinnerSize = size === "small" ? 24 : size === "medium" ? 40 : 80;
  
  return (
    <div className="flex flex-col items-center justify-center h-full">
      <Oval
        height={spinnerSize}
        width={spinnerSize}
        color="#0ea5e9"
        secondaryColor="#bae6fd"
        ariaLabel="oval-loading"
        wrapperStyle={{}}
        wrapperClass=""
        visible={true}
      />
      {message && (
        <p className="mt-4 text-primary-700 dark:text-primary-300 font-medium">{message}</p>
      )}
    </div>
  );
};

export default LoadingSpinner; 