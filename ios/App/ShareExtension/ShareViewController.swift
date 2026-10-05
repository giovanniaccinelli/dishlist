import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let statusLabel = UILabel()
    private var didStartProcessing = false

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        guard !didStartProcessing else { return }
        didStartProcessing = true
        DispatchQueue.main.asyncAfter(deadline: .now() + 0.15) { [weak self] in
            self?.processSharedItems()
        }
    }

    private func configureView() {
        view.backgroundColor = UIColor.black

        let titleLabel = UILabel()
        titleLabel.text = "DishList"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 30, weight: .black)
        titleLabel.textAlignment = .center

        statusLabel.text = "Preparing your dish..."
        statusLabel.textColor = UIColor.white.withAlphaComponent(0.72)
        statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0

        let stack = UIStackView(arrangedSubviews: [titleLabel, statusLabel])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 10
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    private func processSharedItems() {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        loadFirstValue(from: providers, type: UTType.url.identifier) { [weak self] value in
            if let sharedURL = self?.stringFromSharedURLValue(value) {
                self?.openDishList(url: sharedURL, text: nil)
                return
            }
            self?.loadFirstValue(from: providers, type: UTType.plainText.identifier) { textValue in
                self?.openDishList(url: nil, text: self?.stringFromSharedTextValue(textValue))
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

    private func openDishList(url: String?, text: String?) {
        var components = URLComponents()
        components.scheme = "dishlist"
        components.host = "share"

        var queryItems: [URLQueryItem] = []
        if let url, !url.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            queryItems.append(URLQueryItem(name: "url", value: url))
        }
        if let text, !text.trimmingCharacters(in: .whitespacesAndNewlines).isEmpty {
            queryItems.append(URLQueryItem(name: "text", value: text))
        }
        components.queryItems = queryItems

        guard let shareURL = components.url else {
            finish()
            return
        }

        statusLabel.text = "Opening DishList..."
        extensionContext?.open(shareURL) { [weak self] success in
            DispatchQueue.main.async {
                guard let self else { return }
                if success {
                    self.finish()
                    return
                }
                if self.openURLThroughResponderChain(shareURL) {
                    DispatchQueue.main.asyncAfter(deadline: .now() + 0.7) { [weak self] in
                        self?.finish()
                    }
                    return
                }
                self.statusLabel.text = "Could not open DishList. Open the app once, then try sharing again."
            }
        }
    }

    private func openURLThroughResponderChain(_ url: URL) -> Bool {
        let selector = NSSelectorFromString("openURL:")
        var responder: UIResponder? = self
        while let currentResponder = responder {
            if currentResponder.responds(to: selector) {
                currentResponder.perform(selector, with: url)
                return true
            }
            responder = currentResponder.next
        }
        return false
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
