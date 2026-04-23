import { useState, useEffect } from "react"
import {
  signInWithEmailAndPassword,
  createUserWithEmailAndPassword
} from "firebase/auth"
import { Form, Button, Alert, Modal, Spinner } from "react-bootstrap"
import { useNavigate } from "react-router-dom"
import {auth} from "../firebase"

export default function Login() {
  //  Login state
  const [loginEmail, setLoginEmail] = useState("")
  const [loginPassword, setLoginPassword] = useState("")
  const [loginError, setLoginError] = useState("")
  const [loginLoading, setLoginLoading] = useState(false)

  //  Signup state
  const [signupEmail, setSignupEmail] = useState("")
  const [signupPassword, setSignupPassword] = useState("")
  const [signupError, setSignupError] = useState("")
  const [signupLoading, setSignupLoading] = useState(false)

  const [show, setShow] = useState(false)

  const navigate = useNavigate()
  const API_URL = import.meta.env.VITE_API_URL;

  //  Reset modal state on open
  const openSignup = () => {
    setSignupEmail("")
    setSignupPassword("")
    setSignupError("")
    setShow(true)
  }

  //  Autofocus email when modal opens, Delays execution just enough for modal to mount
  useEffect(() => {
    if (show) {
      setTimeout(() => {
        document.getElementById("signup-email")?.focus()
      }, 100)
    }
  }, [show])

  //  Error mapper
  const getErrorMessage = (code) => {
    switch (code) {
      case "auth/email-already-in-use":
        return "Email already exists"
      case "auth/invalid-email":
        return "Invalid email format"
      case "auth/user-not-found":
      case "auth/wrong-password":
      case "auth/invalid-credential":
        return "Invalid email or password"
      case "auth/weak-password":
        return "Password should be at least 6 characters"
      default:
        console.log("Unhandled Firebase error:", code)
        return "Something went wrong"
    }
  }

  //  LOGIN
  const handleLogin = async (e) => {
    e.preventDefault()
    setLoginError("")
    setLoginLoading(true)

    try {
      const userCredential = await signInWithEmailAndPassword(
        auth,
        loginEmail,
        loginPassword
      )

      //Non-blocking DB sync
      fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: userCredential.user.uid,
          display_name: userCredential.user.email
        })
      }).catch((err) => {
        console.error("DB sync failed:", err)
      })

      navigate("/dashboard")
    } catch (err) {
      setLoginError(getErrorMessage(err.code))
      setLoginPassword("") //  UX: clear password on error
    } finally {
      setLoginLoading(false)
    }
  }

  //  SIGNUP
  const handleSignup = async (e) => {
    e.preventDefault()
    setSignupError("")
    setSignupLoading(true)

    try {
      const userCredential = await createUserWithEmailAndPassword(
        auth,
        signupEmail,
        signupPassword
      )

      const res = await fetch(`${API_URL}/signup`, {
        method: "POST",
        headers: {
          "Content-Type": "application/json"
        },
        body: JSON.stringify({
          id: userCredential.user.uid,
          display_name: signupEmail
        })
      })

      if (!res.ok) {
        const data = await res.json()
        throw new Error(data.error || "Failed to create user in DB")
      }

      setShow(false)
      navigate("/dashboard")
    } catch (err) {
      setSignupError(err.code ? getErrorMessage(err.code) : err.message)
    } finally {
      setSignupLoading(false)
    }
  }

  return (
    <div className="relay-shell">
      <main
        className="relay-main px-4 d-flex flex-column justify-content-center"
        style={{ minHeight: "90dvh" }}
      >
        <p className="screen-label mb-2">Day 1 of carrying</p>

        <h1 className="font-serif fst-italic mb-1" style={{ fontSize: 28 }}>
          Welcome back.
        </h1>

        <p className="mb-4" style={{ fontSize: 13, color: "#9a9a94" }}>
          Yesterday's you left something behind.
        </p>

        <Form onSubmit={handleLogin}>
          <Form.Group className="mb-3">
            <Form.Label style={{ fontSize: 12 }}>
              Email address
            </Form.Label>
            <Form.Control
              value={loginEmail}
              onChange={(e) => setLoginEmail(e.target.value)}
              type="email"
              placeholder="you@example.com"
              required
            />
          </Form.Group>

          <Form.Group className="mb-4">
            <Form.Label style={{ fontSize: 12 }}>
              Password
            </Form.Label>
            <Form.Control
              value={loginPassword}
              onChange={(e) => setLoginPassword(e.target.value)}
              type="password"
              placeholder="Enter password"
              required
            />
          </Form.Group>

          {loginError && <Alert variant="warning">{loginError}</Alert>}

          <Button
            type="submit"
            disabled={loginLoading}
            className="btn-amber w-100 py-3 border-0 mb-3"
          >
            {loginLoading ? (
              <>
                <Spinner size="sm" className="me-2" />
                Starting...
              </>
            ) : (
              "Start the relay →"
            )}
          </Button>
        </Form>

        <p className="text-center mb-0" style={{ fontSize: 12 }}>
          No account yet?{" "}
          <Button
            variant="link"
            className="p-0 text-amber"
            onClick={openSignup}
          >
            Create one
          </Button>
        </p>
      </main>

      <Modal show={show} onHide={() => setShow(false)} centered>
        <Modal.Header closeButton style={{ border: "none" }}>
          <Modal.Title className="font-serif fst-italic">
            Begin carrying.
          </Modal.Title>
        </Modal.Header>

        <Modal.Body>
          <Form onSubmit={handleSignup}>
            <Form.Group className="mb-3">
              <Form.Label style={{ fontSize: 12 }}>
                Email address
              </Form.Label>
              <Form.Control
                id="signup-email"
                value={signupEmail}
                onChange={(e) => setSignupEmail(e.target.value)}
                type="email"
                placeholder="you@example.com"
                required
              />
            </Form.Group>

            <Form.Group className="mb-4">
              <Form.Label style={{ fontSize: 12 }}>
                Password
              </Form.Label>
              <Form.Control
                value={signupPassword}
                onChange={(e) => setSignupPassword(e.target.value)}
                type="password"
                placeholder="Enter password"
                required
              />
            </Form.Group>

            {signupError && <Alert variant="warning">{signupError}</Alert>}

            <Button
              type="submit"
              disabled={signupLoading}
              className="btn-amber w-100 py-3 border-0"
            >
              {signupLoading ? (
                <>
                  <Spinner size="sm" className="me-2" />
                  Creating...
                </>
              ) : (
                "Create account →"
              )}
            </Button>
          </Form>
        </Modal.Body>
      </Modal>
    </div>
  )
}