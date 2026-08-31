import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"
import { Link } from "expo-router"

const services = [
  ["Reparaturen", "Von der kleinen Reparatur bis zur Instandsetzung."],
  ["Diagnose", "Moderne Fehlerdiagnose für gängige Marken und Modelle."],
  ["Inspektion & Wartung", "Wartung nach Herstellervorgaben."],
  ["MFK", "Vorbereitung für eine möglichst problemlose Vorführung."],
  ["Ölwechsel", "Fachgerechter Öl- und Filterwechsel."],
  ["Reifenservice", "Wechsel, Auswuchten und Einlagerung."],
]

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.header}>
        <Text style={styles.logo}>ALI AG</Text>
        <Text style={styles.badge}>APP</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>AUTO SERVICE</Text>
        <Text style={styles.title}>Ihre Werkstatt,{"\n"}der Sie vertrauen.</Text>
        <Text style={styles.description}>
          Persönlich, zuverlässig und professionell. Vereinbaren Sie Ihren Termin bequem über die ALI AG App.
        </Text>
        <Link href="/termine" asChild>
          <Pressable style={styles.primaryButton}>
            <Text style={styles.primaryText}>Termin buchen</Text>
          </Pressable>
        </Link>
      </View>

      <View style={styles.section}>
        <Text style={styles.eyebrow}>UNSERE LEISTUNGEN</Text>
        {services.map(([title, description]) => (
          <View key={title} style={styles.card}>
            <Text style={styles.cardTitle}>{title}</Text>
            <Text style={styles.cardText}>{description}</Text>
          </View>
        ))}
      </View>

      <Link href="/termine" asChild>
        <Pressable style={styles.secondaryButton}>
          <Text style={styles.secondaryText}>Meine Termine</Text>
        </Pressable>
      </Link>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090909" },
  content: { padding: 22, paddingBottom: 50 },
  header: { flexDirection: "row", alignItems: "center", justifyContent: "space-between", paddingTop: 20, paddingBottom: 34 },
  logo: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 3 },
  badge: { color: "#aaa", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  hero: { paddingVertical: 25 },
  eyebrow: { color: "#999", fontSize: 11, fontWeight: "700", letterSpacing: 3 },
  title: { color: "#fff", fontSize: 40, lineHeight: 43, fontWeight: "800", marginTop: 14 },
  description: { color: "#aaa", fontSize: 16, lineHeight: 25, marginTop: 18 },
  primaryButton: { backgroundColor: "#fff", paddingVertical: 16, paddingHorizontal: 24, marginTop: 25, alignItems: "center" },
  primaryText: { color: "#090909", fontSize: 13, fontWeight: "800", letterSpacing: 1.5 },
  section: { marginTop: 35 },
  card: { borderWidth: 1, borderColor: "#292929", padding: 18, marginTop: 10, backgroundColor: "#111" },
  cardTitle: { color: "#fff", fontSize: 17, fontWeight: "700" },
  cardText: { color: "#999", fontSize: 13, lineHeight: 20, marginTop: 7 },
  secondaryButton: { borderWidth: 1, borderColor: "#444", paddingVertical: 16, alignItems: "center", marginTop: 28 },
  secondaryText: { color: "#fff", fontSize: 13, fontWeight: "700", letterSpacing: 1 },
})
