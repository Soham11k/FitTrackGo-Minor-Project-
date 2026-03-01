"use client"

import { useEffect, useRef, useState } from "react"
import { initPoseDetection, detectPose } from "@/lib/pose-detection"
import { buildFaceSignature, passesCKFaceFilter, type LandmarkPoint } from "@/lib/face-verification"

interface FaceEnrollCaptureProps {
  onEnrolled: (signature: number[]) => void
  onCancel: () => void
}

export function FaceEnrollCapture({ onEnrolled, onCancel }: FaceEnrollCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const [poseReady, setPoseReady] = useState(false)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    let running = true
    let lastTime = 0

    const runEnroll = async (timestamp: number) => {
      if (!running || !videoRef.current) return
      animRef.current = requestAnimationFrame(runEnroll)
      if (timestamp - lastTime < 100) return
      lastTime = timestamp
      const video = videoRef.current
      if (video.readyState < 2 || video.videoWidth === 0) return

      const result = detectPose(video, timestamp)
      if (!result?.landmarks?.length) return
      const lm = result.landmarks as LandmarkPoint[]
      if (!passesCKFaceFilter(lm)) return
      const sig = buildFaceSignature(lm)
      if (!sig?.length) return

      running = false
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      onEnrolled(sig)
    }

    let cancelled = false
    initPoseDetection().then((ok) => {
      if (cancelled || !ok) return
      setPoseReady(true)
    })

    navigator.mediaDevices
      .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
      .then((stream) => {
        if (cancelled) {
          stream.getTracks().forEach((t) => t.stop())
          return
        }
        streamRef.current = stream
        if (videoRef.current) {
          videoRef.current.srcObject = stream
          videoRef.current.play().catch(() => {})
        }
        animRef.current = requestAnimationFrame(runEnroll)
      })
      .catch(() => {
        if (!cancelled) setError("Camera access needed")
      })

    return () => {
      cancelled = true
      running = false
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [onEnrolled])

  return (
    <div className="flex flex-col items-center gap-4 p-4">
      <div className="relative w-full max-w-sm aspect-video rounded-xl overflow-hidden bg-secondary">
        <video
          ref={videoRef}
          className="absolute inset-0 w-full h-full object-cover"
          style={{ transform: "scaleX(-1)" }}
          playsInline
          muted
        />
      </div>
      {error ? (
        <p className="text-sm text-destructive">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center">
          {poseReady ? "Look at the camera. Face will be captured automatically." : "Initializing camera…"}
        </p>
      )}
      <div className="flex gap-2 w-full max-w-sm">
        <button
          type="button"
          onClick={onCancel}
          className="flex-1 rounded-xl bg-secondary py-2.5 text-sm font-medium text-secondary-foreground"
        >
          Cancel
        </button>
      </div>
    </div>
  )
}
