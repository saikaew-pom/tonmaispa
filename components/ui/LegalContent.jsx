const prose = { font: '400 clamp(14px,1.1vw,16px)/1.8 Inter,sans-serif', color: '#4A4542', margin: '0 0 18px' }
const h2st  = { font: '400 clamp(20px,2.5vw,28px)/1.2 Cormorant Garamond,serif', color: '#1C1917', margin: '40px 0 14px' }
const h3st  = { font: '600 12px Inter,sans-serif', letterSpacing: 1.5, textTransform: 'uppercase', color: '#3B5249', margin: '28px 0 10px' }
const list  = { ...prose, paddingLeft: 22 }
const li    = { marginBottom: 8 }
const table = { width: '100%', borderCollapse: 'collapse', margin: '0 0 18px' }
const th    = { textAlign: 'left', font: '600 11px Inter,sans-serif', letterSpacing: 1, textTransform: 'uppercase', color: '#9B9390', padding: '8px 12px 8px 0', borderBottom: '1px solid #E0D9D0' }
const td    = { font: '400 14px/1.6 Inter,sans-serif', color: '#4A4542', padding: '10px 12px 10px 0', borderBottom: '1px solid #F0ECE6', verticalAlign: 'top' }

// Renders a page built from typed content blocks — {type:'h2'|'h3'|'p'|'ul'|'table', ...}
// so privacy/terms content lives entirely in the i18n dictionaries (dictionary
// values, not JSX), letting MiniMax translate it like any other UI copy.
export default function LegalContent({ blocks = [] }) {
  return blocks.map((block, i) => {
    switch (block.type) {
      case 'h2':
        return <h2 key={i} style={i === 0 ? { ...h2st, margin: '0 0 14px' } : h2st}>{block.text}</h2>
      case 'h3':
        return <h3 key={i} style={h3st}>{block.text}</h3>
      case 'p':
        return <p key={i} style={prose}>{block.text}</p>
      case 'ul':
        return (
          <ul key={i} style={list}>
            {block.items.map((item, j) => (
              <li key={j} style={li}>{item.bold ? <strong>{item.bold}</strong> : null}{item.text}</li>
            ))}
          </ul>
        )
      case 'table':
        return (
          <table key={i} style={table}>
            <thead>
              <tr>{block.headers.map((h, j) => <th key={j} style={th}>{h}</th>)}</tr>
            </thead>
            <tbody>
              {block.rows.map((row, j) => (
                <tr key={j}>
                  {row.map((cell, k) => (
                    <td key={k} style={td}>{k === 0 ? <strong>{cell}</strong> : cell}</td>
                  ))}
                </tr>
              ))}
            </tbody>
          </table>
        )
      case 'contact':
        return (
          <p key={i} style={{ ...prose, color: '#3B5249' }}>
            {block.lines.map((line, j) => <span key={j}>{line}<br /></span>)}
          </p>
        )
      default:
        return null
    }
  })
}
