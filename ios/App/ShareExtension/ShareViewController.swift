import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let statusLabel = UILabel()

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
        processSharedItems()
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
            if let url = value as? URL {
                self?.openDishList(url: url.absoluteString, text: nil)
                return
            }
            self?.loadFirstValue(from: providers, type: UTType.plainText.identifier) { textValue in
                self?.openDishList(url: nil, text: textValue as? String)
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
        extensionContext?.open(shareURL) { [weak self] _ in
            self?.finish()
        }
    }

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }
}
