import React, { useCallback, useState } from "react"
import { useDropzone, Accept } from "react-dropzone"
import imageCompression from "browser-image-compression"
import JSZip from "jszip"
import { saveAs } from "file-saver"

// 변환된 파일 정보를 나타내는 타입
type CompressedFile = {
  originalName: string
  newName: string
  blobUrl: string
  file: File
  sizeBefore: number
  sizeAfter: number
}

function ImageUploader(): JSX.Element {
  const [compressedFiles, setCompressedFiles] = useState<CompressedFile[]>([])
  const [error, setError] = useState<string | null>(null)

  // 드래그 앤 드롭 혹은 파일 선택 시 호출되는 함수
  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    try {
      setError(null)

      // 변환된 파일들을 임시로 저장할 배열
      const convertedFiles: CompressedFile[] = []

      for (const file of acceptedFiles) {
        // browser-image-compression 옵션
        const options = {
          maxSizeMB: 2,
          maxWidthOrHeight: 3000,
          useWebWorker: true,
          fileType: "image/webp",
        }

        // 이미지 압축(변환) 실행
        const compressedBlob = await imageCompression(file, options)

        // Blob URL 생성
        const compressedBlobUrl = URL.createObjectURL(compressedBlob)

        // 원본 파일 이름과 동일하게 하되 확장자는 .webp 로
        const originalFileName = file.name.split(".")[0]
        const newFileName = `${originalFileName}.webp`

        // File 객체로 변환
        const webpFile = new File([compressedBlob], newFileName, {
          type: "image/webp",
        })

        // 변환된 결과를 배열에 추가
        convertedFiles.push({
          originalName: file.name,
          newName: newFileName,
          blobUrl: compressedBlobUrl,
          file: webpFile,
          sizeBefore: file.size,
          sizeAfter: webpFile.size,
        })
      }

      setCompressedFiles((prev) => [...prev, ...convertedFiles])
    } catch (err) {
      console.error(err)
      setError("이미지 변환 중 오류가 발생했습니다.")
    }
  }, [])

  // react-dropzone 훅 설정
  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".png", ".jpg", ".jpeg", ".gif", ".bmp", ".webp"],
    } as Accept, // Accept 타입 단언
    multiple: true,
  })

  // 단일 파일 다운로드
  const handleDownload = (fileInfo: CompressedFile) => {
    const link = document.createElement("a")
    link.href = fileInfo.blobUrl
    link.download = fileInfo.newName
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  // 모든 파일 일괄 다운로드 (ZIP)
  const handleDownloadAll = async () => {
    if (compressedFiles.length === 0) return

    try {
      const zip = new JSZip()

      for (let i = 0; i < compressedFiles.length; i++) {
        const fileInfo = compressedFiles[i]
        // File 객체를 ArrayBuffer로 변환
        const arrayBuffer = await fileInfo.file.arrayBuffer()
        // ZIP에 추가
        zip.file(fileInfo.newName, arrayBuffer)
      }

      // ZIP 생성
      const zipContent = await zip.generateAsync({ type: "blob" })
      const timeStamp = new Date().getTime()
      const zipFileName = `converted_webp_${timeStamp}.zip`

      // 다운로드
      saveAs(zipContent, zipFileName)
    } catch (err) {
      console.error(err)
      setError("ZIP 파일 생성 중 오류가 발생했습니다.")
    }
  }

  return (
    <div
      style={{ width: "100%", maxWidth: 800, margin: "0 auto", padding: 20 }}
    >
      {/* 업로드 영역 */}
      <div
        {...getRootProps()}
        style={{
          border: "2px dashed #ccc",
          borderRadius: 10,
          padding: 20,
          textAlign: "center",
          cursor: "pointer",
          marginBottom: 20,
          background: isDragActive ? "#fafafa" : "transparent",
        }}
      >
        <input {...getInputProps()} />
        {isDragActive ? (
          <p>여기로 파일을 드래그 해주세요...</p>
        ) : (
          <p>여기를 클릭하거나 파일을 드래그해서 업로드하세요</p>
        )}
      </div>

      {/* 오류 표시 */}
      {error && <p style={{ color: "red", marginBottom: 20 }}>{error}</p>}

      {/* 변환된 파일이 여러 개일 경우 ZIP 다운로드 버튼 표시 */}
      {compressedFiles.length > 1 && (
        <div style={{ marginBottom: 20, textAlign: "right" }}>
          <button onClick={handleDownloadAll}>
            모든 파일 일괄 다운로드 (ZIP)
          </button>
        </div>
      )}

      {/* 변환된 파일 목록 (테이블 형식) */}
      {compressedFiles.length > 0 && (
        <table
          style={{
            width: "100%",
            borderCollapse: "collapse",
            marginTop: 10,
            border: "1px solid #ddd",
          }}
        >
          <thead>
            <tr style={{ background: "#f2f2f2" }}>
              <th style={thStyle}>#</th>
              <th style={thStyle}>원본 파일명</th>
              <th style={thStyle}>변환 파일명</th>
              <th style={thStyle}>용량(전 → 후)</th>
              <th style={thStyle}>미리보기</th>
              <th style={thStyle}>다운로드</th>
            </tr>
          </thead>
          <tbody>
            {compressedFiles.map((fileInfo, index) => (
              <tr
                key={fileInfo.blobUrl}
                style={{ borderBottom: "1px solid #ddd" }}
              >
                <td style={tdStyle}>{index + 1}</td>
                <td style={tdStyle}>{fileInfo.originalName}</td>
                <td style={tdStyle}>{fileInfo.newName}</td>
                <td style={tdStyle}>
                  {`${(fileInfo.sizeBefore / 1024).toFixed(1)} KB → ${(
                    fileInfo.sizeAfter / 1024
                  ).toFixed(1)} KB`}
                </td>
                <td style={tdStyle}>
                  <img
                    src={fileInfo.blobUrl}
                    alt={fileInfo.newName}
                    style={{ maxWidth: "100px" }}
                  />
                </td>
                <td style={tdStyle}>
                  <button onClick={() => handleDownload(fileInfo)}>
                    단일 다운로드
                  </button>
                </td>
              </tr>
            ))}
          </tbody>
        </table>
      )}
    </div>
  )
}

// 테이블 스타일 지정 (React.CSSProperties 사용)
const thStyle: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #ddd",
  textAlign: "center",
}

const tdStyle: React.CSSProperties = {
  padding: "10px",
  border: "1px solid #ddd",
  textAlign: "center",
}

export default ImageUploader
