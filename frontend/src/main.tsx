import { StrictMode } from 'react'
import { createRoot } from 'react-dom/client'
import './index.css'
import App from './App.tsx'
import { loadPublicServices } from './data/services'

const root = createRoot(document.getElementById('root')!)

const statusStyle = {
  minHeight: '100vh',
  display: 'flex',
  flexDirection: 'column',
  alignItems: 'center',
  justifyContent: 'center',
  gap: 16,
  padding: 24,
  textAlign: 'center',
} as const

const startApp = async () => {
  root.render(
    <div style={statusStyle} role="status">
      <strong>Đang tải dữ liệu dịch vụ...</strong>
    </div>,
  )

  try {
    await loadPublicServices()
    root.render(
      <StrictMode>
        <App />
      </StrictMode>,
    )
  } catch {
    root.render(
      <div style={statusStyle} role="alert">
        <strong>Không thể tải dữ liệu dịch vụ từ máy chủ.</strong>
        <button type="button" className="btn btn-submit" onClick={() => void startApp()}>
          Thử lại
        </button>
      </div>,
    )
  }
}

void startApp()
