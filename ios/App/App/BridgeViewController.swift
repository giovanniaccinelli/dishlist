import Capacitor
import UIKit

class BridgeViewController: CAPBridgeViewController {
    private let appGroupIdentifier = "group.com.giovanniaccinelli.dishlist.share"
    private let sharePayloadKeyPrefix = "DishListSharePayload:"
    private var pendingSharedPath: String?
    private var shareRouteAttempts = 0

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
        if let payloadComponents = componentsWithSharedPayload(from: components) {
            components = payloadComponents
        }
        components.scheme = nil
        components.host = nil
        components.path = "/share"
        let path = components.string ?? "/share"

        pendingSharedPath = path
        shareRouteAttempts = 0
        routePendingSharedPathWhenReady()
    }

    private func routePendingSharedPathWhenReady() {
        guard let path = pendingSharedPath else { return }
        guard let webView = webView else {
            scheduleShareRouteRetry()
            return
        }

        shareRouteAttempts += 1
        let readyScript = "document.readyState === 'interactive' || document.readyState === 'complete'"
        webView.evaluateJavaScript(readyScript) { [weak self] result, _ in
            guard let self else { return }
            if (result as? Bool) == true {
                self.openSharedPath(path)
                return
            }
            self.scheduleShareRouteRetry()
        }
    }

    private func scheduleShareRouteRetry() {
        guard shareRouteAttempts < 30 else {
            if let path = pendingSharedPath {
                loadSharedPathDirectly(path)
            }
            return
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.2) { [weak self] in
            self?.routePendingSharedPathWhenReady()
        }
    }

    private func openSharedPath(_ path: String) {
        guard let data = try? JSONSerialization.data(withJSONObject: path),
              let escapedPath = String(data: data, encoding: .utf8) else {
            loadSharedPathDirectly(path)
            return
        }

        webView?.evaluateJavaScript("window.location.assign(\(escapedPath));") { [weak self] _, error in
            guard let self else { return }
            if error != nil {
                self.loadSharedPathDirectly(path)
                return
            }
            self.pendingSharedPath = nil
        }
    }

    private func loadSharedPathDirectly(_ path: String) {
        let baseURLString = "https://dishlist7.vercel.app"
        guard let url = URL(string: baseURLString + path) else { return }
        webView?.load(URLRequest(url: url))
        pendingSharedPath = nil
    }

    private func componentsWithSharedPayload(from components: URLComponents) -> URLComponents? {
        guard let payloadId = components.queryItems?.first(where: { $0.name == "payloadId" })?.value,
              !payloadId.isEmpty,
              let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier),
              let payload = sharedDefaults.dictionary(forKey: sharePayloadKeyPrefix + payloadId) else {
            return nil
        }

        sharedDefaults.removeObject(forKey: sharePayloadKeyPrefix + payloadId)
        if sharedDefaults.string(forKey: "DishListLatestSharePayloadId") == payloadId {
            sharedDefaults.removeObject(forKey: "DishListLatestSharePayloadId")
        }
        sharedDefaults.synchronize()

        var resolved = components
        var queryItems: [URLQueryItem] = []
        if let url = payload["url"] as? String, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            queryItems.append(URLQueryItem(name: "url", value: url))
        }
        if let text = payload["text"] as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            queryItems.append(URLQueryItem(name: "text", value: text))
        }
        resolved.queryItems = queryItems
        return resolved
    }
}

extension Notification.Name {
    static let dishListDidOpenShareURL = Notification.Name("DishListDidOpenShareURL")
}
