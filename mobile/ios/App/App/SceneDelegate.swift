import UIKit
import Capacitor

class SceneDelegate: UIResponder, UIWindowSceneDelegate {
    var window: UIWindow?

    func scene(_ scene: UIScene, willConnectTo session: UISceneSession, options connectionOptions: UIScene.ConnectionOptions) {
        guard let windowScene = scene as? UIWindowScene else { return }

        window = UIWindow(windowScene: windowScene)
        window?.rootViewController = MainViewController()
        window?.makeKeyAndVisible()

        SceneDelegateProxy.shared.scene(scene, willConnectTo: session, options: connectionOptions)
    }

    func scene(_ scene: UIScene, openURLContexts URLContexts: Set<UIOpenURLContext>) {
        SceneDelegateProxy.shared.scene(scene, openURLContexts: URLContexts)
    }

    func scene(_ scene: UIScene, continue userActivity: NSUserActivity) {
        SceneDelegateProxy.shared.scene(scene, continue: userActivity)
    }
}

/// 허브패밀리 iOS 의 루트 화면. Capacitor 기본 화면에 두 가지만 더한다.
///
/// 1. 상태바 가림막 — iOS 는 상태바가 투명해, 스크롤한 본문이 시계·배터리 밑으로 비친다.
///    웹 코드는 안드로이드·웹과 공용이라 건드리지 않고, 여기서 상태바 높이만큼 흐린 흰 막을 덮는다
///    (iOS 기본 앱과 같은 흐림). 가로 화면처럼 상태바가 없으면 높이가 0 이 된다.
/// 2. 라이트 모드 고정 — 화면이 흰 바탕 한 가지뿐이라, 폰이 다크 모드면 상태바 글자가 흰색이 되어
///    흰 막 위에서 안 보인다. 앱 안에서는 늘 라이트로 둔다.
class MainViewController: CAPBridgeViewController {
    private let statusBarCover = UIVisualEffectView(effect: UIBlurEffect(style: .systemChromeMaterialLight))

    override func viewDidLoad() {
        super.viewDidLoad()
        overrideUserInterfaceStyle = .light

        statusBarCover.isUserInteractionEnabled = false
        statusBarCover.translatesAutoresizingMaskIntoConstraints = false
        view.addSubview(statusBarCover)
        NSLayoutConstraint.activate([
            statusBarCover.topAnchor.constraint(equalTo: view.topAnchor),
            statusBarCover.leadingAnchor.constraint(equalTo: view.leadingAnchor),
            statusBarCover.trailingAnchor.constraint(equalTo: view.trailingAnchor),
            statusBarCover.bottomAnchor.constraint(equalTo: view.safeAreaLayoutGuide.topAnchor),
        ])
    }
}
