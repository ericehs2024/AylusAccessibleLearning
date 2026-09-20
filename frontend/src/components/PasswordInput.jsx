import React, { useState } from 'react'
import { useTheme } from '../context/ThemeContext'

export default function PasswordInput({ value, onChange, placeholder, style, className = 'input', autoFocus, required, id, name }) {
  const [show, setShow] = useState(false)
  const { isDark } = (()=>{ try{ return useTheme() } catch{ return {isDark:false} } })()
  return (
    <div style={{ position: 'relative', display: 'flex', alignItems: 'center' }}>
      <input
        className={className}
        type={show ? 'text' : 'password'}
        value={value}
        onChange={onChange}
        placeholder={placeholder}
        style={{ ...style, paddingRight: 64 }}
        autoFocus={autoFocus}
        required={required}
        id={id}
        name={name}
      />
      <button
        type="button"
        onClick={() => setShow(s => !s)}
        aria-label={show ? 'Hide password' : 'Show password'}
        aria-pressed={show}
        title={show ? 'Hide password' : 'Show password'}
        style={{
          position: 'absolute',
          right: 6,
          top: '50%',
          transform: 'translateY(-50%)',
          marginTop: style && style.marginTop ? 0 : undefined,
          background: isDark ? '#3a3a3a' : 'white',
          border: `1.5px solid ${isDark ? '#555' : '#111'}`,
          borderRadius: 999,
          padding: '5px 9px',
          fontSize: 11,
          fontWeight: 700,
          letterSpacing: 0.5,
          textTransform: 'uppercase',
          cursor: 'pointer',
          lineHeight: 1,
          color: isDark ? '#e6e6e6' : '#111',
          boxShadow: isDark ? '0 1px 4px rgba(0,0,0,0.3)' : '0 1px 4px rgba(0,0,0,0.08)',
          transition: 'all .2s',
        }}
      >
        {show ? 'Hide' : 'Show'}
      </button>
    </div>
  )
}
