import { useEffect, useState } from "react"
import { ActivityIndicator, KeyboardAvoidingView, Platform, Pressable, StyleSheet, Text, TextInput, View } from "react-native"
import { Link, router } from "expo-router"
import { supabase } from "../lib/supabase"

export default function LoginScreen() {
  const [email, setEmail] = useState("")
  const [password, setPassword] = useState("")
  const [loading, setLoading] = useState(false)
  const [message, setMessage] = useState("")

  useEffect(() => {
    supabase.auth.getSession().then(({ data }) => {
      if (data.session) router.replace("/")
    })
  }, [])

  async function login() {
    if (!email.trim() || !password) {
      setMessage("Bitte E-Mail und Passwort eingeben.")
      return
    }
    setLoading(true)
    setMessage("")
    const { error } = await supabase.auth.signInWithPassword({
      email: email.trim().toLowerCase(),
      password,
    })
    setLoading(false)
    if (error) {
      setMessage(error.message === "Invalid login credentials" ? "E-Mail oder Passwort ist falsch." : error.message)
      return
    }
    router.replace("/")
  }

  return (
    <KeyboardAvoidingView style={styles.container} behavior={Platform.OS === "ios" ? "padding" : undefined}>
      <View style={styles.content}>
        <Text style={styles.logo}>ALI AG</Text>
        <Text style={styles.eyebrow}>ANMELDEN</Text>
        <Text style={styles.title}>Willkommen zurück.</Text>
        <Text style={styles.text}>Verwende dieselben Zugangsdaten wie auf der ALI AG Website.</Text>

        <TextInput value={email} onChangeText={setEmail} placeholder="E-Mail" placeholderTextColor="#777" autoCapitalize="none" autoCorrect={false} keyboardType="email-address" style={styles.input} />
        <TextInput value={password} onChangeText={setPassword} placeholder="Passwort" placeholderTextColor="#777" secureTextEntry style={styles.input} />

        {!!message && <Text style={styles.error}>{message}</Text>}

        <Pressable style={styles.button} onPress={login} disabled={loading}>
          {loading ? <ActivityIndicator color="#090909" /> : <Text style={styles.buttonText}>ANMELDEN</Text>}
        </Pressable>

        <Link href="/" style={styles.back}>‹ Zurück</Link>
      </View>
    </KeyboardAvoidingView>
  )
}

const styles = StyleSheet.create({
  container: { flex: 1, backgroundColor: "#090909" },
  content: { flex: 1, padding: 22, paddingTop: 75 },
  logo: { color: "#fff", fontSize: 22, fontWeight: "800", letterSpacing: 3, marginBottom: 65 },
  eyebrow: { color: "#999", fontSize: 11, fontWeight: "700", letterSpacing: 3 },
  title: { color: "#fff", fontSize: 34, fontWeight: "800", marginTop: 12 },
  text: { color: "#999", fontSize: 15, lineHeight: 23, marginTop: 12, marginBottom: 28 },
  input: { borderWidth: 1, borderColor: "#333", backgroundColor: "#111", color: "#fff", padding: 16, fontSize: 15, marginBottom: 12 },
  error: { color: "#e4a0a0", fontSize: 13, marginBottom: 12 },
  button: { backgroundColor: "#fff", minHeight: 54, alignItems: "center", justifyContent: "center", marginTop: 8 },
  buttonText: { color: "#090909", fontWeight: "800", fontSize: 12, letterSpacing: 1.5 },
  back: { color: "#aaa", textAlign: "center", marginTop: 28, fontSize: 14 },
})
