import Capacitor
import UIKit

class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        bridge?.registerPluginInstance(SignInWithApple())
        bridge?.registerPluginInstance(NativePushBridge())
        bridge?.registerPluginInstance(NativeContactsBridge())
        NotificationCenter.default.addObserver(
            self,
            selector: #selector(handleSharedURLNotification(_:)),
            name: .dishListDidOpenShareURL,
            object: nil
        )
        enableNativeBackSwipe()
        openPendingSharedURL()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        enableNativeBackSwipe()
        openPendingSharedURL()
    }

    deinit {
        NotificationCenter.default.removeObserver(self)
    }

    private func enableNativeBackSwipe() {
        webView?.allowsBackForwardNavigationGestures = true
    }

    @objc private func handleSharedURLNotification(_ notification: Notification) {
        if let rawURL = notification.userInfo?["url"] as? String {
            routeSharedURL(rawURL)
        } else {
            openPendingSharedURL()
        }
    }

    private func openPendingSharedURL() {
        guard let rawURL = UserDefaults.standard.string(forKey: AppDelegate.pendingShareURLKey) else {
            return
        }
        UserDefaults.standard.removeObject(forKey: AppDelegate.pendingShareURLKey)
        routeSharedURL(rawURL)
    }

    private func routeSharedURL(_ rawURL: String) {
        guard let url = URL(string: rawURL),
              var components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return
        }
        components.scheme = nil
        components.host = nil
        components.path = "/share"
        let path = components.string ?? "/share"

        guard let data = try? JSONSerialization.data(withJSONObject: path),
              let escapedPath = String(data: data, encoding: .utf8) else {
            return
        }

        DispatchQueue.main.asyncAfter(deadline: .now() + 0.25) { [weak self] in
            self?.webView?.evaluateJavaScript("window.location.href = \(escapedPath);")
        }
    }
}

extension Notification.Name {
    static let dishListDidOpenShareURL = Notification.Name("DishListDidOpenShareURL")
}
