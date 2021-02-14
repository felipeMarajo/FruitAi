//import React from 'react';
import React, { useState, useEffect, useRef } from 'react';
import {
  StyleSheet,
  Text,
  View,
  TouchableOpacity,
  SafeAreaView, Modal, Vibration, Image
} from 'react-native'
import * as tf from '@tensorflow/tfjs'
import { bundleResourceIO, decodeJpeg } from '@tensorflow/tfjs-react-native'
import { Camera } from 'expo-camera';
import * as RNFS from 'react-native-fs';
import * as ImageManipulator from "expo-image-manipulator";
import * as Speech from 'expo-speech';
import Swiper from 'react-native-deck-swiper';
import {v1 as uuidv1} from 'uuid';

const modelJson = require('../model/model.json');
const modelWeights = require('../model/group1-shard1of1.bin');

export default function TensorCam() {
  
  const [hasPermission, setHasPermission] = useState(null)
  const [capturedPhoto, setCapturedPhoto] = useState(null)
  const [model, setModel] = useState(null)
  const [open, setOpen] = useState(false)
  const [prediction, setPrediction] = useState(null)
  const [classPredicted, setClassPredicted] = useState(null)
  const [capturedPhotoLow, setCapturedPhotoLow] = useState(null)
  const camRef = useRef(null)
  

  useEffect(() => {
    (async () => {
      const {status} = await  Camera.requestPermissionsAsync()
      setHasPermission(status === 'granted')
    })()
  }, []);

  useEffect(() => {
    (async () => {
      await tf.ready();
      const modelo = await tf.loadLayersModel(bundleResourceIO(modelJson, modelWeights));
      console.log("modelo carregado")
      setModel(modelo);
    })()
  }, []);

  if(hasPermission === null){
    return <View/>
  }

  if(hasPermission === false){
    return <Text>Acesso Negado</Text>
  }

  async function uploadImage(url, data){
    let options = {
      headers: {
        'Content-Type': 'multipart/form-data'
      },
      method: 'POST'
    };
    options.body = new FormData()
    for (let key in data) {
      options.body.append(key, data[key]);
    }
    console.log(options.body)
    return await fetch(url, options)
            .then((response) => response.json())
            .then(responseJson => {
              console.log(responseJson)
              return responseJson;
            
            })
            .catch((error) => {
               console.error(error);
            });

  }

  async function uploadImageToServer(){
    let uid = await uuidv1()
    uploadImage('http://add0c9ec17e2.ngrok.io/send-image/', {
      file: {
        uri: capturedPhotoLow,
        type: 'image/jpg',
        name: classPredicted +'_'+ uid + '.jpg'
      }
      }).then(r => {
        //do something with `r`
    });
  }

  async function takePicture(){

    if(camRef){

      const data = await camRef.current.takePictureAsync({ skipProcessing: true } )
      Vibration.vibrate([100, 300])

      const manipResult = await ImageManipulator.manipulateAsync(
        data.uri,
        [{ resize: { width: 224, height: 224 } }],
        { format: 'jpeg'});
        
      const fileUri = manipResult.uri
      const imgB64 = await RNFS.readFile(fileUri, 'base64')      
      const imgBuffer = tf.util.encodeString(imgB64, 'base64').buffer;
      const raw = new Uint8Array(imgBuffer)
      const imageTensor = decodeJpeg(raw); 

      imageTensor.shape = [1,224,224,3]
      console.log("prediction: ")
      const pred = await model.predict(imageTensor).dataSync()
      console.log(pred)
      setPrediction(pred)
      setCapturedPhoto(data.uri)
      setCapturedPhotoLow(fileUri)
      setOpen(true)
    }
  }

  function speak(){

    const classes = {
      0:"Apple",1:"Banana",2:"Carambola",3:"Guava",4:"Kiwi",
      5:"Mango",6:"Orange",7:"Peach",8:"Pear",9:"Persimmon",
      10:"Pitaya",11:"Plum",12:"Pomegranate",13:"Tomatoes",14:"muskmelon"
  }

  var indexOfMaxValue = prediction.reduce((iMax, x, i, arr) => x > arr[iMax] ? i : iMax, 0);

  const fruit = classes[indexOfMaxValue]

  setClassPredicted(indexOfMaxValue)

  console.log(fruit)
  Speech.speak(fruit, {
    language: 'pt'
  })

  }

  function onSwipe(gestureName) {
    switch (gestureName) {
      case 'SWIPE_UP':
        setCapturedPhoto(null)
        setOpen(false)
        //uploadImageToServer()
        console.log('Up')
        break;
      case 'SWIPE_DOWN':
        setCapturedPhoto(null)
        setOpen(false)
        console.log('Down')
        break;
    }
  }

  return(
    <SafeAreaView style={styles.container} >
      <Camera ref={camRef} style={{flex:1}} type={Camera.Constants.Type.back} ratio={'4:3'}>
        <TouchableOpacity style={styles.touch}  activeOpacity={0.6} onLongPress={takePicture}>

        </TouchableOpacity>
      </Camera>
      
      {open && 
        <Swiper 
          verticalSwipe={true}
          horizontalSwipe={false}
          style={{width: '100%', height: '100%'}}
          backgroundColor={'#080808'}
          onSwipedTop={() => {onSwipe('SWIPE_UP')}}
          onSwipedBottom={() => {onSwipe('SWIPE_DOWN')}}
          onTapCard={() => {speak()}}
          overlayLabels={{
            top: {
              element: <Image source={require('../image/cloud_icon.png')}></Image>,
              title: 'CLOUD',
                style: {
                  wrapper: {
                    flexDirection: 'column',
                    alignItems: 'center',
                    justifyContent: 'center',
                    width:'100%',
                    height:'150%'
                  },
                  label: {
                    backgroundColor: 'white',
                    borderColor: 'White',
                    color: 'white',
                    borderWidth: 1
                  }
                }
              },
              bottom: {
                element: <Image source={require('../image/trash_icon.png')}></Image>,
                title: 'BLEAH',
                  style: {
                    label: {
                      backgroundColor: 'black',
                      borderColor: 'black',
                      color: 'white',
                      borderWidth: 1
                    },
                    wrapper: {
                      flexDirection: 'column',
                      alignItems: 'center',
                      justifyContent: 'center',
                      width:'100%',
                      height:'50%'
                    }
                  }
                }
            }}
          cards={[1]}
          renderCard={() => {
            return(
              <View style={styles.card} accessibilityLabel={'Arraste para cima e nos ajude'}>
                <Image style={{width: '100%', height: '100%'}} source={{uri:capturedPhoto}} onLoad={speak}></Image>
              </View>
            )
          }}>

        </Swiper>
      }

    </SafeAreaView>
  );

}

const styles = StyleSheet.create({
  container: {
    flex: 1,
    justifyContent: 'center',
  },
  touch: {
    flex: 1,
    backgroundColor: "transparent"
  },
  card: {
    flex: 1,
    borderRadius: 4,
    borderWidth: 2,
    borderColor: "#E8E8E8",
    justifyContent: "center",
    backgroundColor: "white"
  }
})