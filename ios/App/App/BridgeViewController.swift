import Capacitor
import ObjectiveC.runtime
import UIKit

private enum KeyboardAccessoryHider {
    private static var didApply = false

    static func apply() {
        guard !didApply else { return }
        didApply = true

        ["WKContentView", "UIWebBrowserView"].forEach { className in
            guard
                let targetClass = NSClassFromString(className),
                let method = class_getInstanceMethod(targetClass, Selector(("inputAccessoryView")))
            else {
                return
            }

            let block: @convention(block) (AnyObject) -> UIView? = { _ in nil }
            method_setImplementation(method, imp_implementationWithBlock(block))
        }
    }
}

class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
        KeyboardAccessoryHider.apply()
        bridge?.registerPluginInstance(SignInWithApple())
        bridge?.registerPluginInstance(NativePushBridge())
        enableNativeBackSwipe()
    }

    override func viewDidAppear(_ animated: Bool) {
        super.viewDidAppear(animated)
        enableNativeBackSwipe()
    }

    private func enableNativeBackSwipe() {
        webView?.allowsBackForwardNavigationGestures = true
    }
}
