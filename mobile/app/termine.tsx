import { Link } from "expo-router"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

export default function TermineScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <Link href="/" asChild>
        <Pressable><Text style={styles.back}>‹ Zurück</Text></Pressable>
      </Link>
      <Text style={styles.eyebrow}>ONLINE BUCHEN</Text>
      <Text style={styles.title}>Termin vereinbaren</Text>
      <Text style={styles.text}>Wählen Sie einen Termin und schildern Sie Ihr Anliegen.</Text>
      <View style={styles.info}>
        <Text style={styles.infoTitle}>Terminbuchung</Text>
        <Text style={styles.infoText}>Die bestehende Buchungslogik der ALI AG Website bleibt unangetastet. Die mobile Buchungsoberfläche wird als nächster Schritt mit derselben Supabase-Datenbank verbunden.</Text>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090909" },
  content: { padding: 22, paddingTop: 55 },
  back: { color: "#bbb", fontSize: 15, marginBottom: 45 },
  eyebrow: { color: "#999", fontSize: 11, fontWeight: "700", letterSpacing: 3 },
  title: { color: "#fff", fontSize: 34, fontWeight: "800", marginTop: 12 },
  text: { color: "#aaa", fontSize: 16, lineHeight: 24, marginTop: 14 },
  info: { borderWidth: 1, borderColor: "#292929", backgroundColor: "#111", padding: 20, marginTop: 30 },
  infoTitle: { color: "#fff", fontSize: 18, fontWeight: "700" },
  infoText: { color: "#999", lineHeight: 22, marginTop: 10 },
})
