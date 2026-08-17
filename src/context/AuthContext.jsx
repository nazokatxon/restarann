import React, {
  createContext,
  useContext,
  useEffect,
  useState,
} from "react";

import {
  createUserWithEmailAndPassword,
  signInWithEmailAndPassword,
  signOut,
  onAuthStateChanged,
} from "firebase/auth";

import {
  doc,
  getDoc,
  setDoc,
  serverTimestamp,
} from "firebase/firestore";

import {
  auth,
  db,
  secondaryAuth,
} from "../firebase/config.js";


// ======================================================
// CONTEXT
// ======================================================

const AuthContext = createContext(null);


// ======================================================
// useAuth
// ======================================================

export function useAuth() {
  return useContext(AuthContext);
}


// ======================================================
// AUTH PROVIDER
// ======================================================

export function AuthProvider({ children }) {

  // ====================================================
  // STATE
  // ====================================================

  const [user, setUser] = useState(null);

  const [role, setRole] = useState(null);

  const [cafeId, setCafeId] = useState(null);

  const [loading, setLoading] = useState(true);


  // ====================================================
  // FIRESTORE'DAN USER MA'LUMOTLARINI OLISH
  // ====================================================

  const fetchUserData = async (uid) => {

    try {

      console.log(
        "Firestore user olinmoqda:",
        uid
      );

      const userRef = doc(
        db,
        "users",
        uid
      );

      const userSnap = await getDoc(
        userRef
      );


      // -----------------------------------------------
      // USER TOPILDI
      // -----------------------------------------------

      if (userSnap.exists()) {

        const data =
          userSnap.data();

        console.log(
          "Firestore user topildi:",
          data
        );


        const userRole =
          data.role || null;

        const userCafeId =
          data.cafeId || null;


        setRole(userRole);

        setCafeId(userCafeId);


        return data;
      }


      // -----------------------------------------------
      // USER TOPILMADI
      // -----------------------------------------------

      console.warn(
        "Firestore users ichida user topilmadi:",
        uid
      );


      setRole(null);

      setCafeId(null);


      return null;

    } catch (error) {

      console.error(
        "Foydalanuvchi ma'lumotlarini olishda xatolik:",
        error
      );


      setRole(null);

      setCafeId(null);


      return null;
    }
  };


  // ====================================================
  // ODDIY REGISTER
  // ====================================================

  const register = async (
    email,
    password
  ) => {

    try {

      const emailNormalized =
        email
          .trim()
          .toLowerCase();


      console.log(
        "Register:",
        emailNormalized
      );


      const userCredential =
        await createUserWithEmailAndPassword(
          auth,
          emailNormalized,
          password
        );


      const newUser =
        userCredential.user;


      console.log(
        "Register muvaffaqiyatli:",
        newUser.email
      );


      return newUser;

    } catch (error) {

      console.error(
        "Register xatoligi:",
        error
      );


      throw error;
    }
  };


  // ====================================================
  // XODIM YARATISH
  // ====================================================
  //
  // MUHIM:
  //
  // secondaryAuth ishlatiladi.
  //
  // Sababi:
  //
  // Admin login bo'lib turadi.
  //
  // Agar oddiy auth bilan:
  //
  // createUserWithEmailAndPassword(auth,...)
  //
  // qilsak, admin sessiyasi yangi xodimga
  // almashib ketishi mumkin.
  //
  // Shuning uchun:
  //
  // secondaryAuth
  //
  // ishlatiladi.
  // ====================================================

  const registerStaff = async (
    usernameOrEmail,
    password,
    extraData = {}
  ) => {

    try {

      // -----------------------------------------------
      // TEKSHIRUV
      // -----------------------------------------------

      if (!secondaryAuth) {

        throw new Error(
          "secondaryAuth mavjud emas. firebase config ni tekshiring."
        );
      }


      if (!usernameOrEmail) {

        throw new Error(
          "Xodim loginini kiriting."
        );
      }


      if (!password) {

        throw new Error(
          "Xodim parolini kiriting."
        );
      }


      if (password.length < 6) {

        throw new Error(
          "Parol kamida 6 ta belgidan iborat bo'lishi kerak."
        );
      }


      // -----------------------------------------------
      // EMAIL YASASH
      // -----------------------------------------------

      let email;


      if (
        usernameOrEmail
          .includes("@")
      ) {

        email =
          usernameOrEmail
            .trim()
            .toLowerCase();

      } else {

        email =
          `${usernameOrEmail
            .trim()
            .toLowerCase()}@kafe.uz`;
      }


      // -----------------------------------------------
      // USERNAME
      // -----------------------------------------------

      const username =
        email
          .split("@")[0]
          .trim()
          .toLowerCase();


      console.log(
        "Xodim yaratishga tayyor:",
        email
      );


      // -----------------------------------------------
      // CAFE ID
      // -----------------------------------------------

      const staffCafeId =
        extraData.cafeId || cafeId;


      if (!staffCafeId) {

        throw new Error(
          "Cafe ID topilmadi. Adminning cafeId ma'lumotini tekshiring."
        );
      }


      // -----------------------------------------------
      // FIREBASE AUTH USER YARATISH
      // -----------------------------------------------

      console.log(
        "Firebase Authentication user yaratilmoqda:",
        email
      );


      const userCredential =
        await createUserWithEmailAndPassword(
          secondaryAuth,
          email,
          password
        );


      const newUser =
        userCredential.user;


      console.log(
        "Firebase Auth user yaratildi:",
        newUser.uid
      );


      // -----------------------------------------------
      // FIRESTORE USERS
      // -----------------------------------------------

      const userData = {

        uid: newUser.uid,

        email: email,

        username: username,

        fullName:
          extraData.fullName ||
          "",

        role:
          extraData.role ||
          "waiter",

        cafeId:
          staffCafeId,

        phone:
          extraData.phone ||
          "",

        salary:
          Number(
            extraData.salary || 0
          ),

        status:
          extraData.status ||
          "active",

        createdAt:
          serverTimestamp(),
      };


      // -----------------------------------------------
      // FIRESTORE'GA YOZISH
      // -----------------------------------------------

      await setDoc(
        doc(
          db,
          "users",
          newUser.uid
        ),
        userData
      );


      console.log(
        "Firestore users hujjati yaratildi:",
        newUser.uid
      );


      // -----------------------------------------------
      // SECONDARY AUTH'DAN CHIQISH
      // -----------------------------------------------

      await signOut(
        secondaryAuth
      );


      console.log(
        "Secondary Auth logout qilindi."
      );


      console.log(
        "Xodim muvaffaqiyatli yaratildi:",
        email
      );


      return newUser;


    } catch (error) {

      console.error(
        "Xodim yaratishda xatolik:",
        error
      );


      // ---------------------------------------------
      // ERROR MESSAGE
      // ---------------------------------------------

      if (
        error.code ===
        "auth/email-already-in-use"
      ) {

        console.error(
          "Bu login allaqachon mavjud:",
          usernameOrEmail
        );
      }


      if (
        error.code ===
        "auth/invalid-email"
      ) {

        console.error(
          "Email noto'g'ri:",
          usernameOrEmail
        );
      }


      if (
        error.code ===
        "auth/weak-password"
      ) {

        console.error(
          "Parol juda zaif."
        );
      }


      throw error;
    }
  };


  // ====================================================
  // LOGIN
  // ====================================================

  const login = async (
    usernameOrEmail,
    password
  ) => {

    setLoading(true);


    try {

      // -----------------------------------------------
      // LOGIN INPUT TEKSHIRISH
      // -----------------------------------------------

      if (!usernameOrEmail) {

        throw new Error(
          "Loginni kiriting."
        );
      }


      if (!password) {

        throw new Error(
          "Parolni kiriting."
        );
      }


      // -----------------------------------------------
      // EMAIL YASASH
      // -----------------------------------------------

      let email;


      if (
        usernameOrEmail
          .includes("@")
      ) {

        email =
          usernameOrEmail
            .trim()
            .toLowerCase();

      } else {

        email =
          `${usernameOrEmail
            .trim()
            .toLowerCase()}@kafe.uz`;
      }


      console.log(
        "Login qilinmoqda:",
        email
      );


      // -----------------------------------------------
      // FIREBASE AUTH LOGIN
      // -----------------------------------------------

      const userCredential =
        await signInWithEmailAndPassword(
          auth,
          email,
          password
        );


      const currentUser =
        userCredential.user;


      console.log(
        "Auth user topildi:",
        currentUser.email
      );


      console.log(
        "Auth UID:",
        currentUser.uid
      );


      // -----------------------------------------------
      // FIRESTORE'DAN USER OLISH
      // -----------------------------------------------

      const data =
        await fetchUserData(
          currentUser.uid
        );


      // -----------------------------------------------
      // FIRESTORE USER YO'Q
      // -----------------------------------------------

      if (!data) {

        console.error(
          "Auth user mavjud, lekin Firestore users hujjati mavjud emas."
        );


        await signOut(auth);


        throw new Error(
          "Foydalanuvchi ma'lumotlari topilmadi."
        );
      }


      // -----------------------------------------------
      // STATUS TEKSHIRISH
      // -----------------------------------------------

      if (
        data.status ===
        "inactive"
      ) {

        await signOut(auth);


        throw new Error(
          "Sizning hisobingiz bloklangan."
        );
      }


      // -----------------------------------------------
      // USER STATE
      // -----------------------------------------------

      setUser(
        currentUser
      );


      setRole(
        data.role || null
      );


      setCafeId(
        data.cafeId || null
      );


      console.log(
        "Login muvaffaqiyatli:",
        currentUser.email
      );


      console.log(
        "Role:",
        data.role
      );


      console.log(
        "Cafe ID:",
        data.cafeId
      );


      return data.role || null;


    } catch (error) {

      console.error(
        "Login xatoligi:",
        error
      );


      // ---------------------------------------------
      // FIREBASE ERROR'LARNI ANIQLASH
      // ---------------------------------------------

      switch (error.code) {

        case "auth/invalid-credential":

          console.error(
            "LOGIN yoki PAROL noto'g'ri."
          );

          break;


        case "auth/user-not-found":

          console.error(
            "Bunday Firebase Auth user topilmadi."
          );

          break;


        case "auth/wrong-password":

          console.error(
            "Parol noto'g'ri."
          );

          break;


        case "auth/invalid-email":

          console.error(
            "Email noto'g'ri."
          );

          break;


        case "auth/user-disabled":

          console.error(
            "Firebase Auth user bloklangan."
          );

          break;


        case "auth/too-many-requests":

          console.error(
            "Juda ko'p login urinishlari."
          );

          break;


        default:

          console.error(
            "Firebase error code:",
            error.code
          );
      }


      setLoading(false);


      throw error;


    } finally {

      setLoading(false);
    }
  };


  // ====================================================
  // LOGOUT
  // ====================================================

  const logout = async () => {

    setLoading(true);


    try {

      // -----------------------------------------------
      // ASOSIY AUTH'DAN CHIQISH
      // -----------------------------------------------

      await signOut(auth);


      // -----------------------------------------------
      // SECONDARY AUTH'DAN HAM CHIQISH
      // -----------------------------------------------

      if (secondaryAuth) {

        try {

          await signOut(
            secondaryAuth
          );

        } catch (secondaryError) {

          console.warn(
            "Secondary logout xatoligi:",
            secondaryError
          );
        }
      }


      // -----------------------------------------------
      // STATE RESET
      // -----------------------------------------------

      setUser(null);

      setRole(null);

      setCafeId(null);


      console.log(
        "Logout muvaffaqiyatli."
      );


    } catch (error) {

      console.error(
        "Logout xatoligi:",
        error
      );


      throw error;


    } finally {

      setLoading(false);
    }
  };


  // ====================================================
  // AUTH DATA'NI QO'LDA O'RNATISH
  // ====================================================

  const setAuthData = ({
    user,
    role,
    cafeId,
  }) => {

    setUser(
      user || null
    );

    setRole(
      role || null
    );

    setCafeId(
      cafeId || null
    );
  };


  // ====================================================
  // AUTH HOLATINI KUZATISH
  // ====================================================

  useEffect(() => {

    console.log(
      "Auth listener ishga tushdi."
    );


    const unsubscribe =
      onAuthStateChanged(
        auth,
        async (currentUser) => {

          try {

            setLoading(true);


            // -----------------------------------------
            // USER LOGIN BO'LGAN
            // -----------------------------------------

            if (currentUser) {

              console.log(
                "Auth user topildi:",
                currentUser.email
              );


              console.log(
                "UID:",
                currentUser.uid
              );


              setUser(
                currentUser
              );


              // ---------------------------------------
              // FIRESTORE USER
              // ---------------------------------------

              const data =
                await fetchUserData(
                  currentUser.uid
                );


              if (data) {

                setRole(
                  data.role || null
                );


                setCafeId(
                  data.cafeId || null
                );


                console.log(
                  "Auth ma'lumotlari yuklandi:",
                  {
                    role:
                      data.role,
                    cafeId:
                      data.cafeId,
                  }
                );

              } else {

                console.warn(
                  "Auth bor, lekin Firestore users hujjati yo'q."
                );


                setRole(null);

                setCafeId(null);
              }


            } else {

              // ---------------------------------------
              // USER LOGIN EMAS
              // ---------------------------------------

              console.log(
                "Auth user mavjud emas."
              );


              setUser(null);

              setRole(null);

              setCafeId(null);
            }


          } catch (error) {

            console.error(
              "Auth listener xatoligi:",
              error
            );


            setUser(null);

            setRole(null);

            setCafeId(null);


          } finally {

            setLoading(false);
          }
        }
      );


    // -----------------------------------------------
    // CLEANUP
    // -----------------------------------------------

    return () => {

      console.log(
        "Auth listener to'xtatildi."
      );


      unsubscribe();
    };

  }, []);


  // ====================================================
  // CONTEXT VALUE
  // ====================================================

  const value = {

    // User
    user,

    // Role
    role,

    // Cafe
    cafeId,

    // Loading
    loading,

    // Functions
    login,

    register,

    registerStaff,

    logout,

    setAuthData,
  };


  // ====================================================
  // PROVIDER
  // ====================================================

  return (
    <AuthContext.Provider
      value={value}
    >
      {children}
    </AuthContext.Provider>
  );
}