import { useEffect, useMemo, useState } from "react";
import {
  ActivityIndicator,
  Alert,
  FlatList,
  SafeAreaView,
  StatusBar,
  StyleSheet,
  Text,
  TextInput,
  TouchableOpacity,
  View,
} from "react-native";
import type { Session } from "@supabase/supabase-js";
import { supabase } from "./src/lib/supabase";

type Checkin = {
  id: string;
  beer_name: string;
  rating: number | null;
  created_at: string;
  city?: string | null;
  district?: string | null;
};

export default function App() {
  const [session, setSession] = useState<Session | null>(null);
  const [loading, setLoading] = useState(true);
  const [email, setEmail] = useState("");
  const [password, setPassword] = useState("");
  const [authBusy, setAuthBusy] = useState(false);
  const [checkins, setCheckins] = useState<Checkin[]>([]);
  const [checkinsBusy, setCheckinsBusy] = useState(false);

  const canAuth = useMemo(() => email.trim().length > 4 && password.length >= 6, [email, password]);

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      setSession(data.session);
      setLoading(false);
    });

    const { data: sub } = supabase.auth.onAuthStateChange((_event, nextSession) => {
      setSession(nextSession);
    });

    return () => {
      sub.subscription.unsubscribe();
    };
  }, []);

  useEffect(() => {
    if (!session?.user?.id) {
      setCheckins([]);
      return;
    }
    void loadCheckins(session.user.id);
  }, [session?.user?.id]);

  async function loadCheckins(userId: string) {
    setCheckinsBusy(true);
    const { data, error } = await supabase
      .from("checkins")
      .select("id, beer_name, rating, created_at, city, district")
      .eq("user_id", userId)
      .order("created_at", { ascending: false })
      .limit(30);
    setCheckinsBusy(false);

    if (error) {
      Alert.alert("Check-in yuklenemedi", error.message);
      return;
    }

    setCheckins((data as Checkin[] | null) ?? []);
  }

  async function signIn() {
    if (!canAuth) return;
    setAuthBusy(true);
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim(),
      password,
    });
    setAuthBusy(false);
    if (error) Alert.alert("Giris basarisiz", error.message);
  }

  async function signUp() {
    if (!canAuth) return;
    setAuthBusy(true);
    const { error } = await supabase.auth.signUp({
      email: email.trim(),
      password,
    });
    setAuthBusy(false);
    if (error) {
      Alert.alert("Kayit basarisiz", error.message);
      return;
    }
    Alert.alert("Kayit alindi", "Eger dogrulama maili aciksa emailini onayla, sonra giris yap.");
  }

  async function signOut() {
    const { error } = await supabase.auth.signOut();
    if (error) Alert.alert("Cikis hatasi", error.message);
  }

  if (loading) {
    return (
      <SafeAreaView style={styles.screenCenter}>
        <StatusBar barStyle="light-content" />
        <ActivityIndicator color="#f5b335" />
      </SafeAreaView>
    );
  }

  if (!session) {
    return (
      <SafeAreaView style={styles.screen}>
        <StatusBar barStyle="light-content" />
        <View style={styles.card}>
          <Text style={styles.title}>Birader Mobile</Text>
          <Text style={styles.sub}>Supabase ile giris yap</Text>

          <TextInput
            value={email}
            onChangeText={setEmail}
            style={styles.input}
            placeholder="E-posta"
            placeholderTextColor="#8b8b8b"
            autoCapitalize="none"
            keyboardType="email-address"
          />
          <TextInput
            value={password}
            onChangeText={setPassword}
            style={styles.input}
            placeholder="Sifre"
            placeholderTextColor="#8b8b8b"
            secureTextEntry
          />

          <View style={styles.row}>
            <TouchableOpacity onPress={signIn} disabled={!canAuth || authBusy} style={styles.buttonPrimary}>
              <Text style={styles.buttonPrimaryText}>{authBusy ? "..." : "Giris"}</Text>
            </TouchableOpacity>
            <TouchableOpacity onPress={signUp} disabled={!canAuth || authBusy} style={styles.buttonGhost}>
              <Text style={styles.buttonGhostText}>Kayit</Text>
            </TouchableOpacity>
          </View>

          <Text style={styles.hint}>EXPO_PUBLIC_SUPABASE_URL ve EXPO_PUBLIC_SUPABASE_ANON_KEY gerekli.</Text>
        </View>
      </SafeAreaView>
    );
  }

  return (
    <SafeAreaView style={styles.screen}>
      <StatusBar barStyle="light-content" />
      <View style={styles.header}>
        <View>
          <Text style={styles.title}>Birader Mobile</Text>
          <Text style={styles.sub}>@{session.user.email?.split("@")[0] || "kullanici"}</Text>
        </View>
        <TouchableOpacity onPress={signOut} style={styles.buttonGhostSmall}>
          <Text style={styles.buttonGhostText}>Exit</Text>
        </TouchableOpacity>
      </View>

      <View style={styles.card}>
        <View style={styles.rowBetween}>
          <Text style={styles.sectionTitle}>Son Check-inler</Text>
          <TouchableOpacity
            onPress={() => void loadCheckins(session.user.id)}
            style={styles.buttonGhostSmall}
            disabled={checkinsBusy}
          >
            <Text style={styles.buttonGhostText}>{checkinsBusy ? "..." : "Yenile"}</Text>
          </TouchableOpacity>
        </View>

        {checkinsBusy ? <ActivityIndicator color="#f5b335" style={{ marginTop: 8 }} /> : null}

        <FlatList
          data={checkins}
          keyExtractor={(item) => item.id}
          contentContainerStyle={{ gap: 10, paddingTop: 10, paddingBottom: 12 }}
          renderItem={({ item }) => (
            <View style={styles.checkinRow}>
              <View style={{ flex: 1 }}>
                <Text style={styles.checkinBeer}>{item.beer_name}</Text>
                <Text style={styles.checkinMeta}>{new Date(item.created_at).toLocaleString("tr-TR")}</Text>
                {item.city ? (
                  <Text style={styles.checkinMeta}>📍 {item.city}{item.district ? ` / ${item.district}` : ""}</Text>
                ) : null}
              </View>
              <Text style={styles.checkinRating}>{item.rating == null ? "—" : `${item.rating}⭐`}</Text>
            </View>
          )}
          ListEmptyComponent={
            !checkinsBusy ? <Text style={styles.hint}>Henüz check-in yok.</Text> : null
          }
        />
      </View>
    </SafeAreaView>
  );
}

const styles = StyleSheet.create({
  screen: {
    flex: 1,
    backgroundColor: "#050505",
    paddingHorizontal: 16,
    paddingTop: 12,
  },
  screenCenter: {
    flex: 1,
    backgroundColor: "#050505",
    alignItems: "center",
    justifyContent: "center",
  },
  header: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
    marginBottom: 12,
  },
  card: {
    borderWidth: 1,
    borderColor: "rgba(245,179,53,0.25)",
    borderRadius: 18,
    padding: 14,
    backgroundColor: "rgba(15,15,15,0.9)",
  },
  title: {
    color: "#f5b335",
    fontSize: 24,
    fontWeight: "700",
  },
  sub: {
    color: "#d3d3d3",
    marginTop: 2,
  },
  input: {
    marginTop: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.12)",
    borderRadius: 12,
    paddingHorizontal: 12,
    paddingVertical: 10,
    color: "#f2f2f2",
    backgroundColor: "rgba(255,255,255,0.03)",
  },
  row: {
    flexDirection: "row",
    gap: 10,
    marginTop: 12,
  },
  rowBetween: {
    flexDirection: "row",
    alignItems: "center",
    justifyContent: "space-between",
  },
  buttonPrimary: {
    flex: 1,
    borderRadius: 12,
    backgroundColor: "#f5b335",
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonPrimaryText: {
    color: "#181818",
    fontWeight: "700",
  },
  buttonGhost: {
    flex: 1,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 12,
    paddingVertical: 10,
    alignItems: "center",
  },
  buttonGhostSmall: {
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.2)",
    borderRadius: 10,
    paddingHorizontal: 10,
    paddingVertical: 6,
    alignItems: "center",
  },
  buttonGhostText: {
    color: "#f0f0f0",
    fontSize: 12,
    fontWeight: "600",
  },
  sectionTitle: {
    color: "#f5b335",
    fontSize: 16,
    fontWeight: "700",
  },
  checkinRow: {
    flexDirection: "row",
    alignItems: "center",
    gap: 10,
    borderWidth: 1,
    borderColor: "rgba(255,255,255,0.1)",
    borderRadius: 12,
    padding: 10,
    backgroundColor: "rgba(255,255,255,0.02)",
  },
  checkinBeer: {
    color: "#f2f2f2",
    fontSize: 15,
    fontWeight: "700",
  },
  checkinMeta: {
    marginTop: 2,
    color: "#a8a8a8",
    fontSize: 12,
  },
  checkinRating: {
    color: "#f5b335",
    fontWeight: "700",
  },
  hint: {
    marginTop: 12,
    color: "#9a9a9a",
    fontSize: 12,
  },
});
