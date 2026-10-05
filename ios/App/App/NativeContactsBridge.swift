import Capacitor
import Contacts
import Foundation

@objc(NativeContactsBridge)
public class NativeContactsBridge: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativeContactsBridge"
    public let jsName = "NativeContactsBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "getContacts", returnType: CAPPluginReturnPromise),
    ]

    private let store = CNContactStore()

    @objc func getPermissionStatus(_ call: CAPPluginCall) {
        call.resolve(["contacts": permissionState(CNContactStore.authorizationStatus(for: .contacts))])
    }

    @objc override public func requestPermissions(_ call: CAPPluginCall) {
        store.requestAccess(for: .contacts) { granted, error in
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve(["contacts": granted ? "granted" : "denied"])
        }
    }

    @objc func getContacts(_ call: CAPPluginCall) {
        let status = CNContactStore.authorizationStatus(for: .contacts)
        if status == .notDetermined {
            store.requestAccess(for: .contacts) { granted, error in
                if let error {
                    call.reject(error.localizedDescription)
                    return
                }
                guard granted else {
                    call.reject("Contacts permission denied.")
                    return
                }
                self.readContacts(call)
            }
            return
        }
        guard status == .authorized else {
            call.reject("Contacts permission denied.")
            return
        }
        readContacts(call)
    }

    private func readContacts(_ call: CAPPluginCall) {
        DispatchQueue.global(qos: .userInitiated).async {
            do {
                let keys: [CNKeyDescriptor] = [
                    CNContactEmailAddressesKey as CNKeyDescriptor,
                    CNContactPhoneNumbersKey as CNKeyDescriptor,
                ]
                let request = CNContactFetchRequest(keysToFetch: keys)
                var contacts: [[String: Any]] = []
                try self.store.enumerateContacts(with: request) { contact, _ in
                    let emails = contact.emailAddresses
                        .map { String($0.value).trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }
                    let phones = contact.phoneNumbers
                        .map { $0.value.stringValue.trimmingCharacters(in: .whitespacesAndNewlines) }
                        .filter { !$0.isEmpty }
                    if emails.isEmpty && phones.isEmpty { return }
                    contacts.append([
                        "emails": emails,
                        "phones": phones,
                    ])
                }
                call.resolve(["contacts": contacts])
            } catch {
                call.reject(error.localizedDescription)
            }
        }
    }

    private func permissionState(_ status: CNAuthorizationStatus) -> String {
        switch status {
        case .authorized:
            return "granted"
        case .denied, .restricted:
            return "denied"
        case .notDetermined:
            return "prompt"
        @unknown default:
            return "prompt"
        }
    }
}
