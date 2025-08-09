package com.example.mealtracker

import android.os.Bundle
import android.util.Log
import android.view.View
import android.webkit.ConsoleMessage
import android.webkit.JavascriptInterface
import android.webkit.WebChromeClient
import android.webkit.WebResourceError
import android.webkit.WebResourceRequest
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity
import androidx.core.view.WindowCompat
import androidx.core.view.WindowInsetsCompat
import androidx.core.view.WindowInsetsControllerCompat
import androidx.swiperefreshlayout.widget.SwipeRefreshLayout

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var blackoutView: View
    private lateinit var swipeRefreshLayout: SwipeRefreshLayout

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Enable web content debugging
        WebView.setWebContentsDebuggingEnabled(true)

        // Set full screen using the modern API
        val windowInsetsController = WindowCompat.getInsetsController(window, window.decorView)
        windowInsetsController.systemBarsBehavior = WindowInsetsControllerCompat.BEHAVIOR_SHOW_TRANSIENT_BARS_BY_SWIPE
        windowInsetsController.hide(WindowInsetsCompat.Type.systemBars())

        supportActionBar?.hide()

        webView = findViewById(R.id.webView)
        blackoutView = findViewById(R.id.blackoutView)
        swipeRefreshLayout = findViewById(R.id.swipe_refresh_layout)

        // Configure WebView
        webView.settings.javaScriptEnabled = true

        // Set up clients for WebView
        webView.webViewClient = object : WebViewClient() {
            override fun onPageFinished(view: WebView?, url: String?) {
                super.onPageFinished(view, url)
                swipeRefreshLayout.isRefreshing = false
            }

            override fun onReceivedError(view: WebView?, request: WebResourceRequest?, error: WebResourceError?) {
                super.onReceivedError(view, request, error)
                Log.e("WebViewError", "Error: ${error?.description} on URL: ${request?.url}")
            }
        }

        webView.webChromeClient = object : WebChromeClient() {
            override fun onConsoleMessage(consoleMessage: ConsoleMessage): Boolean {
                Log.d("WebViewConsole", "${consoleMessage.message()} -- From line ${consoleMessage.lineNumber()} of ${consoleMessage.sourceId()}")
                return true
            }
        }

        webView.addJavascriptInterface(WebAppInterface(), "Android")

        // Load your web app
        webView.loadUrl("file:///android_asset/index.html")

        // Wake on tap
        blackoutView.setOnClickListener {
            blackoutView.visibility = View.GONE
        }

        // Handle swipe to refresh
        swipeRefreshLayout.setOnRefreshListener {
            webView.reload()
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun toggleBlackout() {
            runOnUiThread {
                blackoutView.visibility = View.VISIBLE
            }
        }
    }
}