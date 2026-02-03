import React from 'react'
import { X, CheckCircle, AlertCircle, AlertTriangle, Info } from 'lucide-react'

const Alert = ({ type = 'info', message, onClose, className = '' }) => {
  const configs = {
    success: {
      icon: CheckCircle,
      className: 'alert-success',
      iconColor: 'text-green-500'
    },
    error: {
      icon: AlertCircle,
      className: 'alert-error',
      iconColor: 'text-red-500'
    },
    warning: {
      icon: AlertTriangle,
      className: 'alert-warning',
      iconColor: 'text-yellow-500'
    },
    info: {
      icon: Info,
      className: 'alert-info',
      iconColor: 'text-blue-500'
    }
  }

  const config = configs[type] || configs.info
  const Icon = config.icon

  return (
    <div className={`alert ${config.className} flex items-start justify-between ${className} animate-slide-in`}>
      <div className="flex items-start space-x-3">
        <Icon className={`w-5 h-5 ${config.iconColor} flex-shrink-0 mt-0.5`} />
        <p className="text-sm">{message}</p>
      </div>
      {onClose && (
        <button
          onClick={onClose}
          className="text-gray-400 hover:text-gray-600 transition-colors ml-4"
        >
          <X className="w-5 h-5" />
        </button>
      )}
    </div>
  )
}

export default Alert
