import ImageCompressor from "@/components/image-compressor"
import "@/app/globals.css"

export default function Home() {
  return (
    <main className="container">
      <div className="header">
        <h1>Image Compression Tool</h1>
        <p>Upload an image, set your desired target size, and download the optimized result.</p>
      </div>
      <ImageCompressor />
    </main>
  )
}
