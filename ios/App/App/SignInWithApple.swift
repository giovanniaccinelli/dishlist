import AuthenticationServices
import Capacitor
import Foundation

@objc(SignInWithApple)
public class SignInWithApple: CAPPlugin, CAPBridgedPlugin {
    public let identifier = "SignInWithApple"
    public let jsName = "SignInWithApple"
    public let pluginMethods: [CAPPluginMethod] = [
        CAPPluginMethod(name: "authorize", returnType: CAPPluginReturnPromise),
    ]
    private var activeCallbackId: String?

    @objc func authorize(_ call: CAPPluginCall) {
        let provider = ASAuthorizationAppleIDProvider()
        let request = provider.createRequest()
        request.requestedScopes = requestedScopes(from: call)
        request.state = call.getString("state")
        request.nonce = call.getString("nonce")

        activeCallbackId = call.callbackId
        bridge?.saveCall(call)

        let controller = ASAuthorizationController(authorizationRequests: [request])
        controller.delegate = self
        controller.presentationContextProvider = self
        controller.performRequests()
    }

    private func requestedScopes(from call: CAPPluginCall) -> [ASAuthorization.Scope]? {
        guard let scopes = call.getString("scopes") else { return nil }
        var requestedScopes: [ASAuthorization.Scope] = []
        if scopes.contains("email") {
            requestedScopes.append(.email)
        }
        if scopes.contains("name") {
            requestedScopes.append(.fullName)
        }
        return requestedScopes.isEmpty ? nil : requestedScopes
    }
}

extension SignInWithApple: ASAuthorizationControllerDelegate {
    public func authorizationController(
        controller: ASAuthorizationController,
        didCompleteWithAuthorization authorization: ASAuthorization
    ) {
        guard
            let credential = authorization.credential as? ASAuthorizationAppleIDCredential,
            let identityToken = credential.identityToken,
            let authorizationCode = credential.authorizationCode,
            let identityTokenString = String(data: identityToken, encoding: .utf8),
            let authorizationCodeString = String(data: authorizationCode, encoding: .utf8)
        else {
            if let call = activeCall() {
                call.reject("Apple did not return valid credentials.")
                bridge?.releaseCall(call)
            }
            activeCallbackId = nil
            return
        }

        let response: [String: Any] = [
            "user": credential.user,
            "email": credential.email ?? "",
            "givenName": credential.fullName?.givenName ?? "",
            "familyName": credential.fullName?.familyName ?? "",
            "identityToken": identityTokenString,
            "authorizationCode": authorizationCodeString,
        ]

        let result: [String: Any] = [
            "response": response,
        ]

        guard let call = activeCall() else { return }
        call.resolve(result)
        bridge?.releaseCall(call)
        activeCallbackId = nil
    }

    public func authorizationController(controller: ASAuthorizationController, didCompleteWithError error: Error) {
        guard let call = activeCall() else { return }
        call.reject(error.localizedDescription)
        bridge?.releaseCall(call)
        activeCallbackId = nil
    }

    private func activeCall() -> CAPPluginCall? {
        guard let activeCallbackId else { return nil }
        return bridge?.savedCall(withID: activeCallbackId)
    }
}

extension SignInWithApple: ASAuthorizationControllerPresentationContextProviding {
    public func presentationAnchor(for controller: ASAuthorizationController) -> ASPresentationAnchor {
        return bridge?.viewController?.view.window ?? ASPresentationAnchor()
    }
}
