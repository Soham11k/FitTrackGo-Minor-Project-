"use client"

import { useCallback, useEffect, useRef, useState } from "react"
import { bleHeartRateSupported, parseHeartRateMeasurement } from "@/lib/ble-heart-rate"

type BleStatus = "idle" | "connecting" | "connected" | "error"

const HR_SERVICE = "heart_rate"
const HR_MEASUREMENT = "heart_rate_measurement"

export function useBleHeartRate() {
  const [bpm, setBpm] = useState<number | null>(null)
  const [status, setStatus] = useState<BleStatus>("idle")
  const [error, setError] = useState<string | null>(null)
  const [deviceLabel, setDeviceLabel] = useState<string | null>(null)

  const deviceRef = useRef<BluetoothDevice | null>(null)
  const charRef = useRef<BluetoothRemoteGATTCharacteristic | null>(null)
  const handlerRef = useRef<((ev: Event) => void) | null>(null)
  const gattDisconnectRef = useRef<(() => void) | null>(null)

  const supported = bleHeartRateSupported()

  const disconnect = useCallback(async () => {
    const ch = charRef.current
    const handler = handlerRef.current
    const device = deviceRef.current
    const onDisc = gattDisconnectRef.current

    if (device && onDisc) {
      device.removeEventListener("gattserverdisconnected", onDisc)
    }
    gattDisconnectRef.current = null

    if (ch && handler) {
      try {
        ch.removeEventListener("characteristicvaluechanged", handler)
        await ch.stopNotifications()
      } catch {
        /* ignore */
      }
    }
    charRef.current = null
    handlerRef.current = null
    deviceRef.current = null

    setBpm(null)
    setStatus("idle")
    setDeviceLabel(null)
    setError(null)

    try {
      device?.gatt?.disconnect()
    } catch {
      /* ignore */
    }
  }, [])

  const connect = useCallback(async () => {
    if (!supported) return
    const api = navigator.bluetooth
    if (!api) return
    await disconnect()
    setError(null)
    setStatus("connecting")
    try {
      const device = await api.requestDevice({
        filters: [{ services: [HR_SERVICE] }],
        optionalServices: [HR_SERVICE],
      })
      deviceRef.current = device
      setDeviceLabel(device.name?.trim() || "Bluetooth HR")

      const server = device.gatt
      if (!server) {
        setError("No GATT server on this device.")
        setStatus("error")
        deviceRef.current = null
        return
      }

      const gatt = await server.connect()
      const svc = await gatt.getPrimaryService(HR_SERVICE)
      const ch = await svc.getCharacteristic(HR_MEASUREMENT)
      charRef.current = ch

      const onNotify = (ev: Event) => {
        const target = ev.target as BluetoothRemoteGATTCharacteristic
        const v = target.value
        if (!v) return
        const next = parseHeartRateMeasurement(v)
        if (next != null) setBpm(next)
      }
      handlerRef.current = onNotify
      ch.addEventListener("characteristicvaluechanged", onNotify)

      const onGattGone = () => {
        void disconnect()
      }
      gattDisconnectRef.current = onGattGone
      device.addEventListener("gattserverdisconnected", onGattGone)

      await ch.startNotifications()
      setStatus("connected")
    } catch (e) {
      deviceRef.current = null
      const name = e instanceof Error ? e.name : ""
      if (name === "NotFoundError") {
        setStatus("idle")
        setError(null)
        return
      }
      setError(e instanceof Error ? e.message : "Bluetooth error")
      setStatus("error")
    }
  }, [disconnect, supported])

  useEffect(() => {
    return () => {
      void disconnect()
    }
  }, [disconnect])

  return {
    bpm,
    status,
    error,
    deviceLabel,
    supported,
    connect,
    disconnect,
  }
}
