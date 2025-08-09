package com.example.mealtracker

import android.os.Bundle
import android.view.View
import android.webkit.JavascriptInterface
import android.webkit.WebView
import android.webkit.WebViewClient
import androidx.appcompat.app.AppCompatActivity

class MainActivity : AppCompatActivity() {

    private lateinit var webView: WebView
    private lateinit var blackoutView: View

    override fun onCreate(savedInstanceState: Bundle?) {
        super.onCreate(savedInstanceState)
        setContentView(R.layout.activity_main)

        // Set full screen
        window.decorView.systemUiVisibility = View.SYSTEM_UI_FLAG_FULLSCREEN
        supportActionBar?.hide()

        webView = findViewById(R.id.webView)
        blackoutView = findViewById(R.id.blackoutView)

        // Configure WebView
        webView.settings.javaScriptEnabled = true
        webView.webViewClient = WebViewClient()
        webView.addJavascriptInterface(WebAppInterface(), "Android")

        // Load your web app
        webView.loadUrl("file:///android_asset/index.html")

        // Wake on tap
        blackoutView.setOnClickListener {
            blackoutView.visibility = View.GONE
        }
    }

    inner class WebAppInterface {
        @JavascriptInterface
        fun blackout() {
            runOnUiThread {
                blackoutView.visibility = View.VISIBLE
            }
        }
    }
}