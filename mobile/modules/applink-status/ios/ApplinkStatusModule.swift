import ExpoModulesCore

/**
 * iOS deliberately has no equivalent.
 *
 * Universal Links are verified by Apple's CDN fetching apple-app-site-association
 * at install time, and the result is not exposed to the app by any public API.
 * Reporting "unsupported" is the truthful answer; returning "verified" because
 * nothing contradicted it would be worse than returning nothing.
 */
public class ApplinkStatusModule: Module {
  public func definition() -> ModuleDefinition {
    Name("ApplinkStatus")

    Function("isSupported") { () -> Bool in
      false
    }

    AsyncFunction("getDomainStates") { () -> [String: Any] in
      ["supported": false, "linkHandlingAllowed": false, "domains": [String: String]()]
    }

    AsyncFunction("openLinkSettings") {
      if let url = URL(string: UIApplication.openSettingsURLString) {
        DispatchQueue.main.async { UIApplication.shared.open(url) }
      }
    }
  }
}
