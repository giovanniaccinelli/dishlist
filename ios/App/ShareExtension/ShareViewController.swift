import UIKit
import UniformTypeIdentifiers

final class ShareViewController: UIViewController {
    private let appGroupIdentifier = "group.com.giovanniaccinelli.dishlist.share"
    private let sharePayloadKeyPrefix = "DishListSharePayload:"
    private let latestSharePayloadIdKey = "DishListLatestSharePayloadId"
    private let statusLabel = UILabel()
    private let saveButton = UIButton(type: .system)
    private let cancelButton = UIButton(type: .system)

    override func viewDidLoad() {
        super.viewDidLoad()
        configureView()
    }

    private func configureView() {
        view.backgroundColor = UIColor.black

        let titleLabel = UILabel()
        titleLabel.text = "DishList"
        titleLabel.textColor = .white
        titleLabel.font = .systemFont(ofSize: 30, weight: .black)
        titleLabel.textAlignment = .center

        let subtitleLabel = UILabel()
        subtitleLabel.text = "Save to DishList"
        subtitleLabel.textColor = .white
        subtitleLabel.font = .systemFont(ofSize: 22, weight: .black)
        subtitleLabel.textAlignment = .center

        statusLabel.text = "Send this recipe to DishList. It will be ready the next time you open the app."
        statusLabel.textColor = UIColor.white.withAlphaComponent(0.72)
        statusLabel.font = .systemFont(ofSize: 15, weight: .semibold)
        statusLabel.textAlignment = .center
        statusLabel.numberOfLines = 0

        saveButton.setTitle("Save recipe", for: .normal)
        saveButton.setTitleColor(.black, for: .normal)
        saveButton.titleLabel?.font = .systemFont(ofSize: 17, weight: .black)
        saveButton.backgroundColor = UIColor(red: 0.17, green: 0.83, blue: 0.42, alpha: 1)
        saveButton.layer.cornerRadius = 24
        saveButton.heightAnchor.constraint(equalToConstant: 52).isActive = true
        saveButton.addTarget(self, action: #selector(saveRecipeTapped), for: .touchUpInside)

        cancelButton.setTitle("Cancel", for: .normal)
        cancelButton.setTitleColor(UIColor.white.withAlphaComponent(0.72), for: .normal)
        cancelButton.titleLabel?.font = .systemFont(ofSize: 16, weight: .bold)
        cancelButton.backgroundColor = UIColor.white.withAlphaComponent(0.09)
        cancelButton.layer.cornerRadius = 22
        cancelButton.heightAnchor.constraint(equalToConstant: 46).isActive = true
        cancelButton.addTarget(self, action: #selector(cancelTapped), for: .touchUpInside)

        let buttonStack = UIStackView(arrangedSubviews: [saveButton, cancelButton])
        buttonStack.axis = .vertical
        buttonStack.spacing = 10
        buttonStack.widthAnchor.constraint(equalToConstant: 240).isActive = true

        let stack = UIStackView(arrangedSubviews: [titleLabel, subtitleLabel, statusLabel, buttonStack])
        stack.axis = .vertical
        stack.alignment = .center
        stack.spacing = 14
        stack.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(stack)

        NSLayoutConstraint.activate([
            stack.leadingAnchor.constraint(equalTo: view.leadingAnchor, constant: 28),
            stack.trailingAnchor.constraint(equalTo: view.trailingAnchor, constant: -28),
            stack.centerYAnchor.constraint(equalTo: view.centerYAnchor),
        ])
    }

    @objc private func saveRecipeTapped() {
        saveButton.isEnabled = false
        cancelButton.isEnabled = false
        statusLabel.text = "Saving..."
        saveSharedItems()
    }

    @objc private func cancelTapped() {
        extensionContext?.cancelRequest(withError: NSError(domain: "DishListShareExtension", code: 1))
    }

    private func saveSharedItems() {
        let providers = extensionContext?.inputItems
            .compactMap { $0 as? NSExtensionItem }
            .flatMap { $0.attachments ?? [] } ?? []

        loadFirstValue(from: providers, type: UTType.url.identifier) { [weak self] value in
            if let sharedURL = self?.stringFromSharedURLValue(value) {
                self?.saveRecipe(url: sharedURL, text: nil)
                return
            }
            self?.loadFirstValue(from: providers, type: UTType.plainText.identifier) { textValue in
                self?.saveRecipe(url: nil, text: self?.stringFromSharedTextValue(textValue))
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
            statusLabel.text = "Could not save this recipe. Try again."
            saveButton.isEnabled = true
            cancelButton.isEnabled = true
            return
        }

        saveButton.setTitle("Saved", for: .normal)
        saveButton.backgroundColor = UIColor.white
        statusLabel.text = "Saved. Open DishList to turn it into a recipe."
        UIView.animate(withDuration: 0.18, animations: {
            self.saveButton.transform = CGAffineTransform(scaleX: 1.04, y: 1.04)
        }) { _ in
            UIView.animate(withDuration: 0.18) {
                self.saveButton.transform = .identity
            }
        }
        DispatchQueue.main.asyncAfter(deadline: .now() + 1.0) { [weak self] in
            self?.finish()
        }
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

    private func finish() {
        extensionContext?.completeRequest(returningItems: nil)
    }

}
