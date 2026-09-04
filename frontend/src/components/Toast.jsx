import React, { createContext, useContext, useState, useCallback } from 'react'

const ToastContext = createContext(null)
export const useToast = () => useContext(ToastContext)

export function ToastProvider({ children }){
  const [toasts, setToasts] = useState([])
  const [confirm, setConfirm] = useState(null)

  const toast = useCallback((message, type='info')=>{
    const id = Date.now()+Math.random()
    setToasts(t=>[...t, { id, message, type }])
    setTimeout(()=> setToasts(t=>t.filter(x=>x.id!==id)), 3200)
  },[])

  const showConfirm = useCallback((message, opts={})=>{
    return new Promise(resolve=>{
      setConfirm({
        message,
        confirmText: opts.confirmText || 'Delete',
        cancelText: opts.cancelText || 'Cancel',
        danger: opts.danger !== false,
        onConfirm: ()=>{ setConfirm(null); resolve(true) },
        onCancel: ()=>{ setConfirm(null); resolve(false) }
      })
    })
  },[])

  return (
    <ToastContext.Provider value={{ toast, showConfirm }}>
      {children}
      <div style={{position:'fixed', bottom:18, right:18, zIndex:9999, display:'flex', flexDirection:'column', gap:8, pointerEvents:'none'}}>
        {toasts.map(t=>(
          <div key={t.id} style={{
            pointerEvents:'auto',
            padding:'12px 16px', borderRadius:10, fontSize:14, fontWeight:600,
            boxShadow:'0 8px 24px rgba(0,0,0,0.16)', minWidth:260, maxWidth:380,
            background: t.type==='error' ? '#fce8e6' : t.type==='success' ? '#e6f4ea' : 'white',
            color: t.type==='error' ? '#b3261e' : t.type==='success' ? '#137333' : '#202124',
            border: `1px solid ${t.type==='error' ? '#f2a8a0' : t.type==='success' ? '#a8dab5' : '#e8eaed'}`,
            display:'flex', alignItems:'center', gap:10
          }}>
            <span style={{fontSize:16}}>{t.type==='error' ? '✕' : t.type==='success' ? '✓' : 'ℹ'}</span>
            <span style={{flex:1}}>{t.message}</span>
          </div>
        ))}
      </div>

      {confirm && (
        <div style={{position:'fixed', inset:0, background:'rgba(32,33,36,0.45)', display:'flex', alignItems:'center', justifyContent:'center', zIndex:10000, padding:20}} onClick={confirm.onCancel}>
          <div onClick={e=>e.stopPropagation()} style={{background:'white', borderRadius:16, padding:22, maxWidth:420, width:'100%', boxShadow:'0 16px 40px rgba(0,0,0,0.2)'}}>
            <h3 style={{fontSize:16, marginBottom:8}}>Please confirm</h3>
            <p style={{fontSize:14, color:'#5f6368', marginBottom:18}}>{confirm.message}</p>
            <div style={{display:'flex', justifyContent:'flex-end', gap:8}}>
              <button className="btn btn-outline btn-small" onClick={confirm.onCancel}>{confirm.cancelText}</button>
              <button className={`btn btn-small ${confirm.danger ? 'btn-danger' : ''}`} onClick={confirm.onConfirm}>{confirm.confirmText}</button>
            </div>
          </div>
        </div>
      )}
    </ToastContext.Provider>
  )
}
