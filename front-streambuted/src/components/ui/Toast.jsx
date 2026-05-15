import { useEffect } from 'react';
import PropTypes from 'prop-types';

export function Toast({ msg, onDone }) {
  useEffect(() => { 
    const t = setTimeout(onDone, 2200); 
    return () => clearTimeout(t); 
  }, [onDone]);
  
  return <div className="toaster">{msg}</div>;
}

Toast.propTypes = {
  msg: PropTypes.string.isRequired,
  onDone: PropTypes.func.isRequired,
};
