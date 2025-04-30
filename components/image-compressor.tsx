"use client"

import { useState, useCallback, useRef, useEffect } from "react"
import { useDropzone } from "react-dropzone"
import styles from "./image-compressor.module.css"

export default function ImageCompressor() {
  const [originalImage, setOriginalImage] = useState<string | null>(null)
  const [compressedImage, setCompressedImage] = useState<string | null>(null)
  const [originalSize, setOriginalSize] = useState<number>(0)
  const [compressedSize, setCompressedSize] = useState<number>(0)
  const [compressionMethod, setCompressionMethod] = useState<"size" | "percentage">("size")
  const [compressionValue, setCompressionValue] = useState<number>(80)
  const [targetSize, setTargetSize] = useState<number>(100)
  const [isCompressing, setIsCompressing] = useState<boolean>(false)
  const [fileName, setFileName] = useState<string>("")
  const [fileType, setFileType] = useState<string>("")
  const [compressionProgress, setCompressionProgress] = useState<number>(0)
  const compressionTimeoutRef = useRef<NodeJS.Timeout | null>(null)

  const onDrop = useCallback(async (acceptedFiles: File[]) => {
    if (acceptedFiles.length === 0) return

    const file = acceptedFiles[0]
    if (!file.type.startsWith("image/")) return

    setFileName(file.name)
    setFileType(file.type)
    setOriginalSize(file.size)
    setCompressedImage(null)
    setCompressedSize(0)

    const reader = new FileReader()
    reader.onload = () => {
      setOriginalImage(reader.result as string)
    }
    reader.readAsDataURL(file)
  }, [])

  const { getRootProps, getInputProps, isDragActive } = useDropzone({
    onDrop,
    accept: {
      "image/*": [".jpeg", ".jpg", ".png", ".webp"],
    },
    maxFiles: 1,
  })

  // Improved browser-based image compression using Canvas
  const compressImage = async (
    imageDataUrl: string,
    method: "percentage" | "size",
    value: number,
  ): Promise<{ dataUrl: string; size: number }> => {
    return new Promise((resolve, reject) => {
      const img = new Image()
      img.onload = () => {
        // Create canvas
        const canvas = document.createElement("canvas")
        const ctx = canvas.getContext("2d")
        if (!ctx) {
          reject(new Error("Could not get canvas context"))
          return
        }

        // Set canvas dimensions to match image
        canvas.width = img.width
        canvas.height = img.height

        // Draw image onto canvas
        ctx.drawImage(img, 0, 0)

        // For target size method, we need to iteratively adjust quality
        if (method === "size") {
          const targetSizeInBytes = value * 1024
          let min = 0.01
          let max = 0.99
          let currentQuality = 0.7 // Start with a reasonable quality
          let bestQuality = currentQuality
          let bestSize = Number.POSITIVE_INFINITY
          let bestDataUrl = ""
          let iterations = 0
          const maxIterations = 15

          // Function to try compression at a specific quality level
          const tryCompress = (quality: number): number => {
            // Use the appropriate mime type based on the file type
            let mimeType = "image/jpeg"
            if (fileType === "image/png") mimeType = "image/png"
            if (fileType === "image/webp") mimeType = "image/webp"

            const dataUrl = canvas.toDataURL(mimeType, quality)

            // Calculate size
            const byteString = atob(dataUrl.split(",")[1])
            const size = byteString.length

            // Update progress
            setCompressionProgress(Math.min(100, (iterations / maxIterations) * 100))

            // If this is closer to our target than previous attempts, save it
            if (Math.abs(size - targetSizeInBytes) < Math.abs(bestSize - targetSizeInBytes)) {
              bestQuality = quality
              bestSize = size
              bestDataUrl = dataUrl
            }

            return size
          }

          // Binary search for target size
          while (iterations < maxIterations) {
            const size = tryCompress(currentQuality)

            // If we're close enough to target size, break
            if (Math.abs(size - targetSizeInBytes) < targetSizeInBytes * 0.05) {
              break
            }

            // Adjust quality based on result
            if (size > targetSizeInBytes) {
              max = currentQuality
              currentQuality = (min + currentQuality) / 2
            } else {
              min = currentQuality
              currentQuality = (currentQuality + max) / 2
            }

            iterations++
          }

          // Use the best result we found
          resolve({ dataUrl: bestDataUrl, size: bestSize })
        } else {
          // Simple quality-based compression
          const quality = value / 100

          // Use the appropriate mime type based on the file type
          let mimeType = "image/jpeg"
          if (fileType === "image/png") mimeType = "image/png"
          if (fileType === "image/webp") mimeType = "image/webp"

          const dataUrl = canvas.toDataURL(mimeType, quality)

          // Calculate size
          const byteString = atob(dataUrl.split(",")[1])
          const size = byteString.length

          resolve({ dataUrl, size })
        }
      }

      img.onerror = () => {
        reject(new Error("Failed to load image"))
      }

      img.src = imageDataUrl
    })
  }

  const handleCompress = async () => {
    if (!originalImage) return

    setIsCompressing(true)
    setCompressionProgress(0)

    // Simulate progress for better UX
    compressionTimeoutRef.current = setInterval(() => {
      setCompressionProgress((prev) => {
        if (prev >= 90) return prev
        return prev + 5
      })
    }, 200)

    try {
      const result = await compressImage(
        originalImage,
        compressionMethod,
        compressionMethod === "percentage" ? compressionValue : targetSize,
      )

      setCompressedImage(result.dataUrl)
      setCompressedSize(result.size)
      setCompressionProgress(100)
    } catch (error) {
      console.error("Compression failed:", error)
    } finally {
      if (compressionTimeoutRef.current) {
        clearInterval(compressionTimeoutRef.current)
      }
      setIsCompressing(false)
    }
  }

  useEffect(() => {
    return () => {
      if (compressionTimeoutRef.current) {
        clearInterval(compressionTimeoutRef.current)
      }
    }
  }, [])

  const handleDownload = () => {
    if (!compressedImage) return

    const link = document.createElement("a")
    link.href = compressedImage
    link.download = `compressed-${fileName}`
    document.body.appendChild(link)
    link.click()
    document.body.removeChild(link)
  }

  const formatSize = (bytes: number) => {
    if (bytes === 0) return "0 Bytes"
    const k = 1024
    const sizes = ["Bytes", "KB", "MB", "GB"]
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return Number.parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + " " + sizes[i]
  }

  const compressionRatio = originalSize && compressedSize ? ((1 - compressedSize / originalSize) * 100).toFixed(1) : "0"

  return (
    <div className={styles.compressor}>
      <div className={styles.uploadArea} {...getRootProps()}>
        <input {...getInputProps()} />
        <div className={styles.uploadIcon}>
          <svg
            xmlns="http://www.w3.org/2000/svg"
            width="48"
            height="48"
            viewBox="0 0 24 24"
            fill="none"
            stroke="currentColor"
            strokeWidth="2"
            strokeLinecap="round"
            strokeLinejoin="round"
          >
            <path d="M14.5 2H6a2 2 0 0 0-2 2v16a2 2 0 0 0 2 2h12a2 2 0 0 0 2-2V7.5L14.5 2z" />
            <polyline points="14 2 14 8 20 8" />
          </svg>
        </div>
        {isDragActive ? (
          <p>Drop the image here...</p>
        ) : (
          <div>
            <p className={styles.uploadTitle}>Drag & drop an image here, or click to select</p>
            <p className={styles.uploadSubtitle}>Supports JPEG, PNG, and WebP formats</p>
          </div>
        )}
      </div>

      {originalImage && (
        <div className={styles.compressionArea}>
          <div className={styles.imagesContainer}>
            <div className={styles.imageCard}>
              <div className={styles.imageHeader}>
                <h3>Original Image</h3>
                <p>{formatSize(originalSize)}</p>
              </div>
              <div className={styles.imagePreview}>
                <img src={originalImage || "/placeholder.svg"} alt="Original" />
              </div>
            </div>

            <div className={styles.imageCard}>
              <div className={styles.imageHeader}>
                <h3>Compressed Image</h3>
                <p>{compressedImage ? formatSize(compressedSize) : "Not compressed yet"}</p>
              </div>
              <div className={styles.imagePreview}>
                {isCompressing ? (
                  <div className={styles.progressContainer}>
                    <div className={styles.progressBar}>
                      <div className={styles.progressFill} style={{ width: `${compressionProgress}%` }}></div>
                    </div>
                    <p>Compressing... {compressionProgress}%</p>
                  </div>
                ) : compressedImage ? (
                  <img src={compressedImage || "/placeholder.svg"} alt="Compressed" />
                ) : (
                  <div className={styles.placeholderText}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="32"
                      height="32"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M12 5v14" />
                      <path d="m19 12-7 7-7-7" />
                    </svg>
                    <p>Compressed result will appear here</p>
                  </div>
                )}
              </div>
            </div>
          </div>

          <div className={styles.controlsCard}>
            <div className={styles.tabs}>
              <button
                className={`${styles.tab} ${compressionMethod === "size" ? styles.activeTab : ""}`}
                onClick={() => setCompressionMethod("size")}
              >
                Target Size
              </button>
              <button
                className={`${styles.tab} ${compressionMethod === "percentage" ? styles.activeTab : ""}`}
                onClick={() => setCompressionMethod("percentage")}
              >
                Quality
              </button>
            </div>

            <div className={styles.controlsContent}>
              {compressionMethod === "size" ? (
                <div className={styles.sizeControl}>
                  <label htmlFor="target-size">Target Size (KB)</label>
                  <div className={styles.inputGroup}>
                    <input
                      id="target-size"
                      type="number"
                      min="1"
                      value={targetSize}
                      onChange={(e) => setTargetSize(Number(e.target.value))}
                    />
                    <span>KB</span>
                  </div>
                </div>
              ) : (
                <div className={styles.qualityControl}>
                  <label>Quality: {compressionValue}%</label>
                  <input
                    type="range"
                    min="1"
                    max="100"
                    value={compressionValue}
                    onChange={(e) => setCompressionValue(Number(e.target.value))}
                    className={styles.slider}
                  />
                  <div className={styles.sliderLabels}>
                    <span>Lower quality</span>
                    <span>Higher quality</span>
                  </div>
                </div>
              )}

              <div className={styles.actionButtons}>
                <button className={styles.compressButton} onClick={handleCompress} disabled={isCompressing}>
                  <svg
                    xmlns="http://www.w3.org/2000/svg"
                    width="16"
                    height="16"
                    viewBox="0 0 24 24"
                    fill="none"
                    stroke="currentColor"
                    strokeWidth="2"
                    strokeLinecap="round"
                    strokeLinejoin="round"
                  >
                    <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                    <polyline points="17 8 12 3 7 8" />
                    <line x1="12" y1="3" x2="12" y2="15" />
                  </svg>
                  Compress Image
                </button>
                {compressedImage && (
                  <button className={styles.downloadButton} onClick={handleDownload}>
                    <svg
                      xmlns="http://www.w3.org/2000/svg"
                      width="16"
                      height="16"
                      viewBox="0 0 24 24"
                      fill="none"
                      stroke="currentColor"
                      strokeWidth="2"
                      strokeLinecap="round"
                      strokeLinejoin="round"
                    >
                      <path d="M21 15v4a2 2 0 0 1-2 2H5a2 2 0 0 1-2-2v-4" />
                      <polyline points="7 10 12 15 17 10" />
                      <line x1="12" y1="15" x2="12" y2="3" />
                    </svg>
                    Download
                  </button>
                )}
              </div>
            </div>
          </div>

          {compressedImage && (
            <div className={styles.resultsCard}>
              <h3>Compression Results</h3>
              <div className={styles.resultsGrid}>
                <div className={styles.resultItem}>
                  <p className={styles.resultLabel}>Original Size</p>
                  <p className={styles.resultValue}>{formatSize(originalSize)}</p>
                </div>
                <div className={styles.resultItem}>
                  <p className={styles.resultLabel}>Compressed Size</p>
                  <p className={styles.resultValue}>{formatSize(compressedSize)}</p>
                </div>
                <div className={styles.resultItem}>
                  <p className={styles.resultLabel}>Compression Ratio</p>
                  <p className={styles.resultValue}>{compressionRatio}% reduction</p>
                </div>
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
