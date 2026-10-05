import Capacitor
import UIKit

class BridgeViewController: CAPBridgeViewController {
    private let appGroupIdentifier = "group.com.giovanniaccinelli.dishlist.share"
    private let sharePayloadKeyPrefix = "DishListSharePayload:"
    private let latestSharePayloadIdKey = "DishListLatestSharePayloadId"
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
            openLatestSharedPayloadIfNeeded()
            return
        }
        UserDefaults.standard.removeObject(forKey: AppDelegate.pendingShareURLKey)
        routeSharedURL(rawURL)
    }

    private func openLatestSharedPayloadIfNeeded() {
        guard pendingSharedPath == nil,
              let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier),
              let payloadId = sharedDefaults.string(forKey: latestSharePayloadIdKey),
              !payloadId.isEmpty else {
            return
        }
        routeSharedURL("dishlist://share?payloadId=\(payloadId)")
    }

    private func routeSharedURL(_ rawURL: String) {
        guard let url = URL(string: rawURL),
              let components = URLComponents(url: url, resolvingAgainstBaseURL: false) else {
            return
        }
        let resolvedComponents = componentsWithSharedPayload(from: components) ?? components
        let label = sharedRecipeLabel(from: resolvedComponents)
        var profileComponents = URLComponents()
        profileComponents.path = "/profile"
        profileComponents.queryItems = [URLQueryItem(name: "sharedRecipe", value: label)]
        let path = profileComponents.string ?? "/profile"

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
        if sharedDefaults.string(forKey: latestSharePayloadIdKey) == payloadId {
            sharedDefaults.removeObject(forKey: latestSharePayloadIdKey)
        }
        sharedDefaults.synchronize()

        var resolved = components
        var queryItems: [URLQueryItem] = []
        if let url = payload["url"] as? String, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            queryItems.append(URLQueryItem(name: "url", value: clipped(url, maxLength: 220)))
        }
        if let text = payload["text"] as? String, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            queryItems.append(URLQueryItem(name: "text", value: clipped(text, maxLength: 220)))
        }
        resolved.queryItems = queryItems
        return resolved
    }

    private func sharedRecipeLabel(from components: URLComponents) -> String {
        let text = components.queryItems?.first(where: { $0.name == "text" })?.value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if !text.isEmpty {
            let firstChunk = text
                .components(separatedBy: CharacterSet(charactersIn: "\n."))
                .first?
                .trimmingCharacters(in: .whitespacesAndNewlines) ?? text
            return clipped(firstChunk, maxLength: 80)
        }

        let rawURL = components.queryItems?.first(where: { $0.name == "url" })?.value?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        if let url = URL(string: rawURL), let host = url.host, !host.isEmpty {
            return clipped(host.replacingOccurrences(of: "www.", with: ""), maxLength: 80)
        }
        if !rawURL.isEmpty {
            return clipped(rawURL, maxLength: 80)
        }
        return "Recipe"
    }

    private func clipped(_ value: String, maxLength: Int) -> String {
        let trimmed = value.trimmingCharacters(in: .whitespacesAndNewlines)
        guard trimmed.count > maxLength else { return trimmed }
        return String(trimmed.prefix(maxLength))
    }
}

extension Notification.Name {
    static let dishListDidOpenShareURL = Notification.Name("DishListDidOpenShareURL")
}
