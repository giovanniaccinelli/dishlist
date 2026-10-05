import Social
import UIKit
import UniformTypeIdentifiers

final class ShareViewController: SLComposeServiceViewController {
    private let appGroupIdentifier = "group.com.giovanniaccinelli.dishlist.share"
    private let sharePayloadKeyPrefix = "DishListSharePayload:"
    private let latestSharePayloadIdKey = "DishListLatestSharePayloadId"

    override func viewDidLoad() {
        super.viewDidLoad()
        title = "Save to DishList"
        placeholder = "Save this recipe to DishList"
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        navigationItem.title = "Save to DishList"
        navigationController?.navigationBar.topItem?.rightBarButtonItem?.title = "Save"
    }

    override func isContentValid() -> Bool {
        true
    }

    override func didSelectPost() {
        saveSharedItems()
    }

    override func configurationItems() -> [Any]! {
        []
    }

    private func saveSharedItems() {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        loadFirstValue(from: providers, type: UTType.url.identifier) { [weak self] value in
            guard let self = self else { return }
            if let sharedURL = self.stringFromSharedURLValue(value) {
                self.saveRecipe(url: sharedURL, text: self.contentText)
                return
            }
            self.loadFirstValue(from: providers, type: UTType.plainText.identifier) { [weak self] textValue in
                guard let self = self else { return }
                self.saveRecipe(url: nil, text: self.stringFromSharedTextValue(textValue) ?? self.contentText)
            }
        }
    }

    private func loadFirstValue(from providers: [NSItemProvider], type: String, completion: @escaping (Any?) -> Void) {
        guard let provider = providers.first(where: { $0.hasItemConformingToTypeIdentifier(type) }) else {
            completion(nil)
            return
        }

        provider.loadItem(forTypeIdentifier: type, options: nil) { item, _ in
            DispatchQueue.main.async {
                completion(item)
            }
        }
    }

    private func stringFromSharedURLValue(_ value: Any?) -> String? {
        if let url = value as? URL {
            return url.absoluteString
        }
        if let url = value as? NSURL {
            return url.absoluteString
        }
        if let string = value as? String,
           let parsedURL = URL(string: string),
           parsedURL.scheme == "http" || parsedURL.scheme == "https" {
            return parsedURL.absoluteString
        }
        return nil
    }

    private func stringFromSharedTextValue(_ value: Any?) -> String? {
        if let string = value as? String {
            return string
        }
        if let attributed = value as? NSAttributedString {
            return attributed.string
        }
        if let url = value as? URL {
            return url.absoluteString
        }
        return nil
    }

    private func saveRecipe(url: String?, text: String?) {
        guard persistSharePayload(url: url, text: text) != nil else {
            extensionContext?.cancelRequest(withError: NSError(domain: "DishListShareExtension", code: 2))
            return
        }
        extensionContext?.completeRequest(returningItems: nil)
    }

    private func persistSharePayload(url: String?, text: String?) -> String? {
        guard let sharedDefaults = UserDefaults(suiteName: appGroupIdentifier) else {
            return nil
        }
        let payloadId = UUID().uuidString
        let trimmedURL = url?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        let trimmedText = text?.trimmingCharacters(in: .whitespacesAndNewlines) ?? ""
        sharedDefaults.set(
            [
                "url": trimmedURL,
                "text": trimmedText,
                "createdAt": Date().timeIntervalSince1970,
            ],
            forKey: sharePayloadKeyPrefix + payloadId
        )
        sharedDefaults.set(payloadId, forKey: latestSharePayloadIdKey)
        sharedDefaults.synchronize()
        return payloadId
    }
}
