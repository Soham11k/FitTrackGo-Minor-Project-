/** Minimal Web Bluetooth typings (not in default TS `dom` lib). */

interface BluetoothDevice extends EventTarget {
  readonly id: string
  readonly name?: string | null
  readonly gatt?: BluetoothRemoteGATTServer | null
  addEventListener(type: "gattserverdisconnected", listener: () => void): void
  removeEventListener(type: "gattserverdisconnected", listener: () => void): void
}

interface BluetoothRemoteGATTServer {
  connect(): Promise<BluetoothRemoteGATTServer>
  disconnect(): void
  getPrimaryService(service: BluetoothServiceUUID): Promise<BluetoothRemoteGATTService>
}

interface BluetoothRemoteGATTService {
  readonly device: BluetoothDevice
  getCharacteristic(characteristic: BluetoothCharacteristicUUID): Promise<BluetoothRemoteGATTCharacteristic>
}

interface BluetoothRemoteGATTCharacteristic extends EventTarget {
  readonly value?: DataView | null
  readonly service: BluetoothRemoteGATTService
  addEventListener(type: "characteristicvaluechanged", listener: (ev: Event) => void): void
  removeEventListener(type: "characteristicvaluechanged", listener: (ev: Event) => void): void
  startNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
  stopNotifications(): Promise<BluetoothRemoteGATTCharacteristic>
}

type BluetoothServiceUUID = string | number
type BluetoothCharacteristicUUID = string | number

interface Bluetooth extends EventTarget {
  requestDevice(options?: RequestDeviceOptions): Promise<BluetoothDevice>
}

interface RequestDeviceOptions {
  filters?: Array<{ services?: BluetoothServiceUUID[] }>
  optionalServices?: BluetoothServiceUUID[]
  acceptAllDevices?: boolean
}

interface Navigator {
  bluetooth?: Bluetooth
}
