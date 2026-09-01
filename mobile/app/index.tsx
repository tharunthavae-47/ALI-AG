import { Link } from "expo-router"
import { Pressable, ScrollView, StyleSheet, Text, View } from "react-native"

const services = [
  ["Reparaturen", "Von der kleinen Reparatur bis zur großen Instandsetzung – schnell und zuverlässig."],
  ["Diagnose", "Moderne Fehlerdiagnose für alle gängigen Marken und Modelle."],
  ["Inspektion & Wartung", "Regelmäßige Wartung nach Herstellervorgaben für ein langes Fahrzeugleben."],
  ["MFK", "Wir bereiten Ihr Fahrzeug für eine möglichst problemlose Vorführung vor."],
  ["Ölwechsel", "Fachgerechter Öl- und Filterwechsel mit hochwertigen Materialien."],
  ["Reifenservice", "Reifenwechsel, Einlagerung und Auswuchten – alles aus einer Hand."],
]

export default function HomeScreen() {
  return (
    <ScrollView style={styles.container} contentContainerStyle={styles.content}>
      <View style={styles.nav}>
        <Text style={styles.logo}>ALI AG</Text>
        <Text style={styles.navLabel}>AUTO REPARATUR & SERVICE</Text>
      </View>

      <View style={styles.hero}>
        <Text style={styles.eyebrow}>AUTO REPARATUR & SERVICE</Text>
        <Text style={styles.title}>Ihre Werkstatt,{"\n"}<Text style={styles.muted}>der Sie vertrauen.</Text></Text>
        <Text style={styles.description}>Persönlich, zuverlässig und professionell. Wir kümmern uns um Ihr Fahrzeug, als wäre es unser eigenes.</Text>
        <View style={styles.actions}>
          <Link href="/termine" asChild><Pressable style={styles.primary}><Text style={styles.primaryText}>TERMIN BUCHEN</Text></Pressable></Link>
          <Link href="/termine" asChild><Pressable style={styles.outline}><Text style={styles.outlineText}>LEISTUNGEN</Text></Pressable></Link>
        </View>
      </View>

      <View style={styles.divider} />
      <View style={styles.section}>
        <Text style={styles.eyebrow}>WAS WIR TUN</Text>
        <Text style={styles.sectionTitle}>Leistungen rund um Ihr Fahrzeug</Text>
        <Text style={styles.sectionText}>Von Reparaturen und Diagnose bis hin zu Wartung, MFK, Ölwechsel und Reifenservice – wir kümmern uns zuverlässig um Ihr Fahrzeug.</Text>
        <View style={styles.grid}>
          {services.map(([title, description], index) => (
            <View key={title} style={styles.card}>
              <Text style={styles.number}>{String(index + 1).padStart(2, "0")}</Text>
              <Text style={styles.cardTitle}>{title}</Text>
              <Text style={styles.cardText}>{description}</Text>
              <Text style={styles.more}>MEHR ERFAHREN  ↓</Text>
            </View>
          ))}
        </View>
        <Link href="/termine" asChild><Pressable style={styles.bottomButton}><Text style={styles.bottomText}>TERMIN VEREINBAREN</Text></Pressable></Link>
      </View>
    </ScrollView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090909" },
  content: { paddingBottom: 55 },
  nav: { paddingHorizontal: 22, paddingTop: 52, paddingBottom: 25, borderBottomWidth: 1, borderBottomColor: "#222", flexDirection: "row", justifyContent: "space-between", alignItems: "center" },
  logo: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 3 },
  navLabel: { color: "#777", fontSize: 8, letterSpacing: 1.8, fontWeight: "700" },
  hero: { paddingHorizontal: 22, paddingTop: 75, paddingBottom: 70 },
  eyebrow: { color: "#888", fontSize: 10, fontWeight: "700", letterSpacing: 3 },
  title: { color: "#fff", fontSize: 42, lineHeight: 44, fontWeight: "800", marginTop: 18, letterSpacing: -1 },
  muted: { color: "#777" },
  description: { color: "#999", fontSize: 15, lineHeight: 24, marginTop: 20, maxWidth: 360 },
  actions: { flexDirection: "row", gap: 10, marginTop: 30 },
  primary: { backgroundColor: "#fff", paddingHorizontal: 18, paddingVertical: 16 },
  primaryText: { color: "#090909", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  outline: { borderWidth: 1, borderColor: "#444", paddingHorizontal: 18, paddingVertical: 16 },
  outlineText: { color: "#fff", fontSize: 10, fontWeight: "800", letterSpacing: 1.4 },
  divider: { height: 1, backgroundColor: "#222" },
  section: { paddingHorizontal: 22, paddingTop: 65 },
  sectionTitle: { color: "#fff", fontSize: 31, lineHeight: 35, fontWeight: "800", marginTop: 15 },
  sectionText: { color: "#888", fontSize: 14, lineHeight: 22, marginTop: 15 },
  grid: { marginTop: 30 },
  card: { backgroundColor: "#101010", borderWidth: 1, borderColor: "#272727", padding: 20, marginBottom: 10 },
  number: { color: "#555", fontSize: 11, fontWeight: "700", letterSpacing: 2 },
  cardTitle: { color: "#fff", fontSize: 19, fontWeight: "700", marginTop: 18 },
  cardText: { color: "#888", fontSize: 13, lineHeight: 20, marginTop: 8 },
  more: { color: "#aaa", fontSize: 9, fontWeight: "700", letterSpacing: 1.4, marginTop: 20 },
  bottomButton: { backgroundColor: "#fff", paddingVertical: 17, alignItems: "center", marginTop: 22 },
  bottomText: { color: "#090909", fontSize: 10, fontWeight: "800", letterSpacing: 1.5 },
})
