import { useRef, useState, useEffect, useCallback } from 'react'

export default function useImagePreload() {
  const [imgLoaded, setImgLoaded] = useState(false)
  const imgRef = useRef(null)

  useEffect(() => {
    const checkImg = () => {
      if (imgRef.current?.complete && imgRef.current.naturalHeight !== 0) {
        setImgLoaded(true)
      } else {
        setImgLoaded(false)
      }
    }
    const interval = setInterval(checkImg, 200)
    checkImg()
    return () => clearInterval(interval)
  }, [])

  return { imgLoaded, imgRef }
}
