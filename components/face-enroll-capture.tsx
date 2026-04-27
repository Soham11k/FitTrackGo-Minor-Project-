"use client"

import { useEffect, useRef, useState } from "react"
import { initPoseDetection, detectPose } from "@/lib/pose-detection"
import { initFaceLandmarker, isFaceLandmarkerReady, detectFaceSignature } from "@/lib/face-landmarker-client"
import type { LandmarkPoint } from "@/lib/face-verification"
import { FACE_ENROLL_STABLE_FRAMES, EMBEDDING_VERSION_POSE, EMBEDDING_VERSION_FACE_MESH } from "@/lib/face-verification"
import {
  pushConsecutiveEnrollmentFrame,
  pushConsecutiveMeshEnrollmentFrame,
  getUserMediaErrorMessage,
} from "@/lib/face-enrollment-capture"

interface FaceEnrollCaptureProps {
  onEnrolled: (signature: number[], embeddingVersion: number) => void
  onCancel: () => void
}

export function FaceEnrollCapture({ onEnrolled, onCancel }: FaceEnrollCaptureProps) {
  const videoRef = useRef<HTMLVideoElement>(null)
  const streamRef = useRef<MediaStream | null>(null)
  const animRef = useRef<number>(0)
  const meshBufferRef = useRef<number[][]>([])
  const poseBufferRef = useRef<number[][]>([])
  const [poseReady, setPoseReady] = useState(false)
  const [faceReady, setFaceReady] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const [progress, setProgress] = useState(0)
  const onEnrolledRef = useRef(onEnrolled)
  useEffect(() => {
    onEnrolledRef.current = onEnrolled
  }, [onEnrolled])

  useEffect(() => {
    let cancelled = false
    let running = true
    let lastTime = 0
    meshBufferRef.current = []
    poseBufferRef.current = []
    setProgress(0)
    setError(null)
    setPoseReady(false)
    setFaceReady(false)

    const runEnroll = (timestamp: number) => {
      if (!running || cancelled) return
      if (!videoRef.current) {
        animRef.current = requestAnimationFrame(runEnroll)
        return
      }
      animRef.current = requestAnimationFrame(runEnroll)
      if (timestamp - lastTime < 100) return
      lastTime = timestamp
      const video = videoRef.current
      if (video.readyState < 2 || video.videoWidth === 0) return

      const useMesh = isFaceLandmarkerReady()
      if (useMesh) {
        poseBufferRef.current = []
        const meshSig = detectFaceSignature(video, timestamp, "enroll")
        const { buffer, signature, progress: p } = pushConsecutiveMeshEnrollmentFrame(meshBufferRef.current, meshSig)
        meshBufferRef.current = buffer
        setProgress(p)
        if (!signature) return
        running = false
        cancelAnimationFrame(animRef.current)
        streamRef.current?.getTracks().forEach((t) => t.stop())
        streamRef.current = null
        onEnrolledRef.current(signature, EMBEDDING_VERSION_FACE_MESH)
        return
      }

      meshBufferRef.current = []
      const result = detectPose(video, timestamp)
      if (!result?.landmarks?.length) return
      const lm = result.landmarks as LandmarkPoint[]
      const { buffer, signature, progress: p } = pushConsecutiveEnrollmentFrame(poseBufferRef.current, lm)
      poseBufferRef.current = buffer
      setProgress(p)
      if (!signature) return
      running = false
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
      onEnrolledRef.current(signature, EMBEDDING_VERSION_POSE)
    }

    void Promise.all([initPoseDetection(), initFaceLandmarker()]).then(([poseOk, faceOk]) => {
      if (cancelled) return
      if (!poseOk) {
        setError("Pose model failed to load. Check your network and try again.")
        return
      }
      setPoseReady(true)
      setFaceReady(faceOk)
      navigator.mediaDevices
        .getUserMedia({ video: { facingMode: "user", width: { ideal: 640 }, height: { ideal: 480 } } })
        .then((stream) => {
          if (cancelled) {
            stream.getTracks().forEach((t) => t.stop())
            return
          }
          streamRef.current = stream
          const v = videoRef.current
          if (v) {
            v.srcObject = stream
            v.play().catch(() => {})
            animRef.current = requestAnimationFrame(runEnroll)
          } else {
            requestAnimationFrame(() => {
              if (cancelled) return
              const v2 = videoRef.current
              if (v2) {
                v2.srcObject = stream
                v2.play().catch(() => {})
                animRef.current = requestAnimationFrame(runEnroll)
              } else {
                setError("Camera preview not ready. Try again.")
                stream.getTracks().forEach((t) => t.stop())
              }
            })
          }
        })
        .catch((e) => {
          if (!cancelled) setError(getUserMediaErrorMessage(e))
        })
    })

    return () => {
      cancelled = true
      running = false
      cancelAnimationFrame(animRef.current)
      streamRef.current?.getTracks().forEach((t) => t.stop())
      streamRef.current = null
    }
  }, [])

  const hint =
    faceReady && poseReady
      ? "Using on-device face mesh for enrollment (more reliable than pose-only)."
      : poseReady
        ? "Face mesh unavailable — enrolling with pose landmarks (re-enroll after a software update for stronger matching)."
        : ""

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
        <p className="text-sm text-destructive text-center px-1">{error}</p>
      ) : (
        <p className="text-sm text-muted-foreground text-center">
          {poseReady
            ? progress > 0
              ? `Hold still — ${progress} / ${FACE_ENROLL_STABLE_FRAMES} stable frames`
              : "Position your face in frame. Capture starts when the model sees you clearly."
            : "Loading models…"}
        </p>
      )}
      {hint ? <p className="text-xs text-emerald-600/90 dark:text-emerald-400/90 text-center max-w-sm">{hint}</p> : null}
      <p className="text-xs text-muted-foreground text-center max-w-sm">
        Face data stays in this browser (IndexedDB) for rep verification; it is not uploaded to our servers. Re-enroll if you use another device or clear site data.
      </p>
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
