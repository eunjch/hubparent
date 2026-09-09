package kr.co.mangotree.hubfamily;

import android.app.NotificationChannel;
import android.app.NotificationManager;
import android.content.Context;
import android.media.AudioAttributes;
import android.net.Uri;
import android.os.Build;

import com.getcapacitor.JSObject;
import com.getcapacitor.Plugin;
import com.getcapacitor.PluginCall;
import com.getcapacitor.PluginMethod;
import com.getcapacitor.annotation.CapacitorPlugin;

/**
 * 복약 "알람" 채널.
 *
 * Capacitor 의 createChannel 은 소리를 알림(USAGE_NOTIFICATION)으로 만든다.
 * 시계 앱처럼 울리려면 USAGE_ALARM 이어야 한다 — 알람 볼륨을 따르고, 무음·진동 모드와
 * 방해 금지를 넘는다. 채널은 한 번 만들면 못 바꾸므로 여기서만 만든다.
 * 이 채널을 로컬 알림(LocalNotifications.schedule channelId)과 서버 푸시(FCM channel_id)가 같이 쓴다.
 */
@CapacitorPlugin(name = "AlarmChannel")
public class AlarmChannelPlugin extends Plugin {

    public static final String CHANNEL_ID = "medication_alarm";

    @PluginMethod
    public void ensure(PluginCall call) {
        ensureChannel(getContext());
        JSObject ret = new JSObject();
        ret.put("id", CHANNEL_ID);
        call.resolve(ret);
    }

    public static void ensureChannel(Context context) {
        if (Build.VERSION.SDK_INT < Build.VERSION_CODES.O) {
            return;
        }
        NotificationManager nm = context.getSystemService(NotificationManager.class);
        if (nm.getNotificationChannel(CHANNEL_ID) != null) {
            return;
        }
        Uri sound = Uri.parse("android.resource://" + context.getPackageName() + "/raw/medic_alarm");
        AudioAttributes attrs = new AudioAttributes.Builder()
            .setUsage(AudioAttributes.USAGE_ALARM)
            .setContentType(AudioAttributes.CONTENT_TYPE_SONIFICATION)
            .build();

        NotificationChannel channel = new NotificationChannel(
            CHANNEL_ID, "약 복용 알람", NotificationManager.IMPORTANCE_HIGH);
        channel.setDescription("약 드실 시간에 알람처럼 울립니다");
        channel.setSound(sound, attrs);
        channel.enableVibration(true);
        channel.setVibrationPattern(new long[] {0, 600, 300, 600, 300, 600});
        channel.enableLights(true);
        // 방해 금지 중에도 울린다 — 사용자가 알림 접근 설정에서 허용해 줘야 실제로 뚫린다
        channel.setBypassDnd(true);
        channel.setLockscreenVisibility(android.app.Notification.VISIBILITY_PUBLIC);
        nm.createNotificationChannel(channel);
    }
}
