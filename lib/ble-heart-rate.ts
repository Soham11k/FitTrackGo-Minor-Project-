/** Standard BLE Heart Rate GATT (Bluetooth SIG). Many chest straps and bike sensors expose this; most Fitbit bands do not (they sync via Fitbit’s app/cloud). */

export function parseHeartRateMeasurement(dataView: DataView): number | null {
  if (dataView.byteLength < 2) return null
  const flags = dataView.getUint8(0)
  const uint16 = (flags & 0x1) !== 0
  if (uint16) {
    if (dataView.byteLength < 3) return null
    const v = dataView.getUint16(1, true)
    return v > 0 && v < 300 ? v : null
  }
  const v = dataView.getUint8(1)
  return v > 0 && v < 250 ? v : null
}

export function bleHeartRateSupported(): boolean {
  if (typeof navigator === "undefined" || typeof window === "undefined") return false
  if (!window.isSecureContext) return false
  const bt = navigator.bluetooth
  return typeof bt?.requestDevice === "function"
}
