import React from 'react'

export default function SectionView({ sections }){
  if(!sections || sections.length===0) return <p style={{color:'#5f6368'}}>No content yet.</p>
  return (
    <div>
      {sections.map((s, idx)=>(
        <div key={s.id || idx} style={{marginBottom:18}}>
          {s.image && <img src={s.image} alt="" className="section-img" />}
          <p style={{whiteSpace:'pre-wrap'}}>{s.text}</p>
        </div>
      ))}
    </div>
  )
}
