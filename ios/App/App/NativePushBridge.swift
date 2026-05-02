import Capacitor
import Foundation
import UIKit
import UserNotifications

extension Notification.Name {
    static let dishListDidRegisterForRemoteNotifications = Notification.Name("DishListDidRegisterForRemoteNotifications")
    static let dishListDidFailToRegisterForRemoteNotifications = Notification.Name("DishListDidFailToRegisterForRemoteNotifications")
    static let dishListDidReceivePushNotification = Notification.Name("DishListDidReceivePushNotification")
    static let dishListDidOpenPushNotification = Notification.Name("DishListDidOpenPushNotification")
}

@objc(NativePushBridge)
public class NativePushBridge: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "NativePushBridge"
    public let jsName = "NativePushBridge"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "getPermissionStatus", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "requestPermissions", returnType: CAPPluginReturnPromise),
        CAPPluginMethod(name: "register", returnType: CAPPluginReturnPromise),
    ]

    public override func load() {
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRegistration(_:)),
            name: .dishListDidRegisterForRemoteNotifications,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleRegistrationError(_:)),
            name: .dishListDidFailToRegisterForRemoteNotifications,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePushReceived(_:)),
            name: .dishListDidReceivePushNotification,
            object: nil
        )
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handlePushOpened(_:)),
            name: .dishListDidOpenPushNotification,
            object: nil
        )
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    @objc func getPermissionStatus(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().getNotificationSettings { settings in
            call.resolve([
                "receive": self.permissionState(from: settings.authorizationStatus),
            ])
        }
    }

    @objc func requestPermissions(_ call: CAPPluginCall) {
        UNUserNotificationCenter.current().requestAuthorization(options: [.alert, .badge, .sound]) { granted, error in
            if let error {
                call.reject(error.localizedDescription)
                return
            }
            call.resolve([
                "receive": granted ? "granted" : "denied",
            ])
        }
    }

    @objc func register(_ call: CAPPluginCall) {
        DispatchQueue.main.async {
            UIApplication.shared.registerForRemoteNotifications()
            call.resolve()
        }
    }

    private func permissionState(from status: UNAuthorizationStatus) -> String {
        switch status {
        case .authorized, .provisional, .ephemeral:
            return "granted"
        case .denied:
            return "denied"
        case .notDetermined:
            return "prompt"
        @unknown default:
            return "prompt"
        }
    }

    @objc private func handleRegistration(_ notification: Notification) {
        let token = notification.userInfo?["token"] as? String ?? ""
        guard !token.isEmpty else { return }
        notifyListeners("registration", data: ["token": token])
    }

    @objc private func handleRegistrationError(_ notification: Notification) {
        let message = notification.userInfo?["error"] as? String ?? "Unknown push registration error"
        notifyListeners("registrationError", data: ["error": message])
    }

    @objc private func handlePushReceived(_ notification: Notification) {
        let payload = notification.userInfo?["payload"] as? [String: Any] ?? [:]
        notifyListeners("pushNotificationReceived", data: ["notification": payload])
    }

    @objc private func handlePushOpened(_ notification: Notification) {
        let payload = notification.userInfo?["payload"] as? [String: Any] ?? [:]
        notifyListeners("pushNotificationActionPerformed", data: ["notification": payload])
    }
}
