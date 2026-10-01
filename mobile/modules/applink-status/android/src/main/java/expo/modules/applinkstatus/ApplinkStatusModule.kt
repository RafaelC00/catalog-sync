package expo.modules.applinkstatus

import android.content.Intent
import android.content.pm.verify.domain.DomainVerificationManager
import android.content.pm.verify.domain.DomainVerificationUserState
import android.net.Uri
import android.os.Build
import android.provider.Settings
import androidx.annotation.RequiresApi
import expo.modules.kotlin.exception.Exceptions
import expo.modules.kotlin.modules.Module
import expo.modules.kotlin.modules.ModuleDefinition

/**
 * Reports whether Android actually verified this app's App Links.
 *
 * The intent filter registered by plugins/withDeepLinks.ts sets
 * autoVerify="true", which asks Android to fetch /.well-known/assetlinks.json
 * from each claimed host at install time. That check can fail quietly: a
 * missing file, a wrong SHA-256 fingerprint, or a redirect all leave the app
 * installed and working while every deep link opens the browser instead.
 *
 * Nothing in JavaScript can observe that, because the decision lives in the
 * package manager, not in the app. DomainVerificationManager (API 31+) is the
 * only way to read it, which is why this is a native module rather than
 * another config plugin.
 */
class ApplinkStatusModule : Module() {
  override fun definition() = ModuleDefinition {
    Name("ApplinkStatus")

    // API 31 is where DomainVerificationManager landed. Below it, Android used
    // a different, unreadable verification mechanism, so the honest answer is
    // "cannot tell" rather than a fabricated "verified".
    Function("isSupported") {
      Build.VERSION.SDK_INT >= Build.VERSION_CODES.S
    }

    AsyncFunction("getDomainStates") {
      if (Build.VERSION.SDK_INT < Build.VERSION_CODES.S) {
        return@AsyncFunction mapOf(
          "supported" to false,
          "linkHandlingAllowed" to false,
          "domains" to emptyMap<String, String>()
        )
      }
      readDomainStates()
    }

    /**
     * Opens the system "Open by default" screen for this app. The only route
     * back from an unverified state is the user adding the link manually, and
     * that screen is where they do it.
     */
    AsyncFunction("openLinkSettings") {
      val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
      val intent = if (Build.VERSION.SDK_INT >= Build.VERSION_CODES.S) {
        Intent(
          Settings.ACTION_APP_OPEN_BY_DEFAULT_SETTINGS,
          Uri.parse("package:${context.packageName}")
        )
      } else {
        Intent(
          Settings.ACTION_APPLICATION_DETAILS_SETTINGS,
          Uri.parse("package:${context.packageName}")
        )
      }.addFlags(Intent.FLAG_ACTIVITY_NEW_TASK)
      context.startActivity(intent)
    }
  }

  @RequiresApi(Build.VERSION_CODES.S)
  private fun readDomainStates(): Map<String, Any> {
    val context = appContext.reactContext ?: throw Exceptions.ReactContextLost()
    val manager = context.getSystemService(DomainVerificationManager::class.java)
      ?: return mapOf(
        "supported" to false,
        "linkHandlingAllowed" to false,
        "domains" to emptyMap<String, String>()
      )

    val userState = manager.getDomainVerificationUserState(context.packageName)

    val domains = userState?.hostToStateMap.orEmpty().mapValues { (_, state) ->
      when (state) {
        DomainVerificationUserState.DOMAIN_STATE_VERIFIED -> "verified"
        DomainVerificationUserState.DOMAIN_STATE_SELECTED -> "userSelected"
        DomainVerificationUserState.DOMAIN_STATE_NONE -> "none"
        else -> "unknown"
      }
    }

    return mapOf(
      "supported" to true,
      // False means the user switched link handling off for this app entirely,
      // in which case per-domain state is moot.
      "linkHandlingAllowed" to (userState?.isLinkHandlingAllowed ?: false),
      "domains" to domains
    )
  }
}
