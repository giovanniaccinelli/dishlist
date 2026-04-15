import Capacitor
import UIKit

class BridgeViewController: CAPBridgeViewController {
    override func capacitorDidLoad() {
        super.capacitorDidLoad()
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
