package kr.co.mangotree.hubfamily;

import android.os.Bundle;

import com.getcapacitor.BridgeActivity;

public class MainActivity extends BridgeActivity {
    @Override
    public void onCreate(Bundle savedInstanceState) {
        registerPlugin(AlarmChannelPlugin.class);
        super.onCreate(savedInstanceState);
        // 앱이 뜨는 순간 채널을 보장한다 — JS 가 돌기 전에 온 푸시도 이 채널을 쓸 수 있게
        AlarmChannelPlugin.ensureChannel(this);
    }
}
